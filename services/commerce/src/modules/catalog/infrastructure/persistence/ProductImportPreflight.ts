import { createHash } from 'node:crypto';
import type { SqlExecutor } from '../../../../platform/database/PgTransactionAccess';
import type { ReadTransactionContext } from '../../../../platform/database/TransactionContext';
import type { CatalogPartnerPort } from '../../../partner/public';
import type { CatalogQualificationPort } from '../../../qualification/public';
import type { ImportCandidate, ImportFailure, ImportPreparedBatch } from '../../../runtime/public';
import { Sku } from '../../domain/model/Sku';

interface CategoryRow {
  readonly id: string;
  readonly code: string;
  readonly name: string;
  readonly status: 'active' | 'disabled';
  readonly required_attributes: readonly string[];
}

interface ProductDraft {
  readonly row: number;
  readonly spu: string;
  readonly title: string;
  readonly sku: string;
  readonly category: string;
  readonly supplier: string | null;
  readonly kind: 'physical' | 'virtual' | 'service' | 'voucher';
  readonly attributes: Readonly<Record<string, unknown>>;
  readonly specifications: Readonly<Record<string, unknown>>;
}

export async function prepareProducts(
  database: SqlExecutor,
  context: ReadTransactionContext,
  scope: string,
  rows: readonly ImportCandidate[],
  partners: CatalogPartnerPort,
  qualifications: CatalogQualificationPort
): Promise<ImportPreparedBatch> {
  const parsed = rows.map(parseRow);
  const candidates = parsed.filter((item): item is ProductDraft => !('reason' in item));
  const categories = await categoryMap(
    database,
    candidates.map(({ category }) => category)
  );
  const partnerScopes = await partners.scopes(context, unique(candidates.flatMap(({ supplier }) => (supplier === null ? [] : [supplier]))));
  const resolved = candidates.map((item) => resolve(item, categories, partnerScopes));
  const eligible = resolved.filter((item): item is ProductDraft => !('reason' in item));
  const decisions = await qualifications.decisions(
    context,
    scope,
    eligible.map((item) =>
      Object.freeze({
        listing: `importrow:${item.row}`,
        product: productId(scope, item.spu),
        category: item.category,
        partner: item.supplier,
        regions: regions(item.attributes),
      })
    )
  );
  const qualification = new Map(decisions.map((decision) => [decision.listing, decision.eligible]));
  const results = new Map<number, ProductDraft | ImportFailure>();
  for (const item of parsed) results.set(item.row, item);
  for (const item of resolved) results.set(item.row, item);
  for (const item of eligible) {
    if (qualification.get(`importrow:${item.row}`) === false) results.set(item.row, failure(item.row, 'CATALOG_QUALIFICATION_BLOCKED', null, '该商品不满足当前范围的经营资格要求'));
  }
  const failures = [...results.values()].filter((item): item is ImportFailure => 'reason' in item);
  return Object.freeze({
    rows: Object.freeze(
      rows.map(({ row }) => {
        const item = results.get(row);
        return Object.freeze({ row, payload: item && !('reason' in item) ? payload(item) : Object.freeze({ invalid: item && 'reason' in item ? item.reason : 'CATALOG_IMPORT_ROW_INVALID' }) });
      })
    ),
    failures: Object.freeze(failures),
  });
}

function parseRow({ row, value }: ImportCandidate): ProductDraft | ImportFailure {
  try {
    const spu = required(value.spu, 'spu', 128);
    const title = required(value.title, 'title', 300);
    const sku = Sku.normalizeCode(required(value.sku, 'sku', 128));
    const category = required(value.category, 'category', 128);
    const supplier = optional(value.supplier, 255);
    if (supplier !== null && !/^partner:[A-Za-z0-9][A-Za-z0-9.:/-]*$/.test(supplier)) return failure(row, 'CATALOG_SUPPLIER_INVALID', 'supplier', '供应商标识格式不正确');
    if (!/^[A-Za-z0-9][A-Za-z0-9._:/-]{0,127}$/.test(spu)) return failure(row, 'CATALOG_SPU_INVALID', 'spu', 'SPU 编码格式不正确');
    const kind = optional(value.type, 32) ?? 'physical';
    if (!isKind(kind)) return failure(row, 'CATALOG_PRODUCT_TYPE_INVALID', 'type', '商品类型必须是 physical、virtual、service 或 voucher');
    const attributes = objectValue(value.attributes, 'CATALOG_ATTRIBUTES_INVALID');
    const specifications = objectValue(value.specifications, 'CATALOG_SPECIFICATIONS_INVALID');
    return Object.freeze({ row, spu, title, sku, category, supplier, kind, attributes: withImages(attributes, value.images, title), specifications });
  } catch (cause) {
    const value = cause instanceof Error ? cause.message : 'CATALOG_IMPORT_ROW_INVALID';
    const [code, field = ''] = value.split(':');
    return failure(row, code && /^[A-Z][A-Z0-9_]{2,127}$/.test(code) ? code : 'CATALOG_IMPORT_ROW_INVALID', field || null, detailFor(code));
  }
}

function resolve(item: ProductDraft, categories: ReadonlyMap<string, CategoryRow[]>, partners: ReadonlyMap<string, string>): ProductDraft | ImportFailure {
  const matches = categories.get(item.category) ?? [];
  if (matches.length !== 1) return failure(item.row, matches.length === 0 ? 'CATALOG_CATEGORY_UNKNOWN' : 'CATALOG_CATEGORY_AMBIGUOUS', 'category', matches.length === 0 ? '找不到对应类目' : '类目名称不唯一，请改用类目编码');
  const category = matches[0]!;
  if (category.status !== 'active') return failure(item.row, 'CATALOG_CATEGORY_DISABLED', 'category', '该类目已停用');
  if (item.supplier !== null && !partners.has(item.supplier)) return failure(item.row, 'CATALOG_SUPPLIER_UNKNOWN', 'supplier', '找不到可用供应商或供应商已停用');
  const missing = category.required_attributes.filter((key) => missingAttribute(item.attributes[key]));
  if (missing.length > 0) return failure(item.row, 'CATALOG_ATTRIBUTE_REQUIRED', 'attributes', `缺少类目必填属性：${missing.join('、')}`);
  return Object.freeze({ ...item, category: category.id });
}

async function categoryMap(database: SqlExecutor, references: readonly string[]): Promise<ReadonlyMap<string, CategoryRow[]>> {
  const wanted = unique(references);
  if (wanted.length === 0) return new Map();
  const result = await database.query<CategoryRow>(
    `select id,code,name,status,required_attributes from catalog.category
     where id=any($1::text[]) or code=any($1::text[]) or name=any($1::text[]) order by id`,
    [wanted]
  );
  const mapped = new Map<string, CategoryRow[]>();
  for (const row of result.rows)
    for (const key of [row.id, row.code, row.name]) {
      if (!wanted.includes(key)) continue;
      mapped.set(key, [...(mapped.get(key) ?? []), row]);
    }
  return mapped;
}

function payload(item: ProductDraft): Readonly<Record<string, string>> {
  return Object.freeze({
    spu: item.spu,
    title: item.title,
    sku: item.sku,
    category: item.category,
    supplier: item.supplier ?? '',
    type: item.kind,
    attributes: JSON.stringify(item.attributes),
    specifications: JSON.stringify(item.specifications),
  });
}

function withImages(attributes: Readonly<Record<string, unknown>>, value: string | undefined, title: string): Readonly<Record<string, unknown>> {
  if (!value?.trim()) return Object.freeze({ ...attributes });
  let parsed: unknown;
  try {
    parsed = JSON.parse(value);
  } catch {
    throw new Error('CATALOG_IMAGES_INVALID:images');
  }
  if (!Array.isArray(parsed) || parsed.length < 1 || parsed.length > 20 || parsed.some((url) => typeof url !== 'string' || !safeImage(url))) {
    throw new Error('CATALOG_IMAGES_INVALID:images');
  }
  const media = parsed.map((url, sort) => Object.freeze({ id: `media:import:${digest(url)}`, kind: 'image', url, alt: title, sort }));
  return Object.freeze({ ...attributes, coverUrl: parsed[0], media: Object.freeze(media) });
}

function safeImage(value: string): boolean {
  if (value.length > 2048) return false;
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && url.username === '' && url.password === '' && url.hostname.includes('.');
  } catch {
    return false;
  }
}

function objectValue(value: string | undefined, code: string): Readonly<Record<string, unknown>> {
  if (!value?.trim()) return Object.freeze({});
  let parsed: unknown;
  try {
    parsed = JSON.parse(value);
  } catch {
    throw new Error(`${code}:${code === 'CATALOG_ATTRIBUTES_INVALID' ? 'attributes' : 'specifications'}`);
  }
  if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error(`${code}:${code === 'CATALOG_ATTRIBUTES_INVALID' ? 'attributes' : 'specifications'}`);
  return Object.freeze({ ...(parsed as Readonly<Record<string, unknown>>) });
}

function required(value: string | undefined, field: string, maximum: number): string {
  const result = value?.trim() ?? '';
  if (!result || result.length > maximum) throw new Error(`CATALOG_${field.toUpperCase()}_REQUIRED:${field}`);
  return result;
}

function optional(value: string | undefined, maximum: number): string | null {
  const result = value?.trim() ?? '';
  if (!result) return null;
  if (result.length > maximum) throw new Error('CATALOG_FIELD_TOO_LONG');
  return result;
}

function failure(row: number, reason: string, field: string | null, detail: string): ImportFailure {
  return Object.freeze({ row, reason, field, detail });
}

function detailFor(code: string | undefined): string {
  const messages: Readonly<Record<string, string>> = Object.freeze({
    CATALOG_SPU_REQUIRED: '请填写 SPU 编码',
    CATALOG_TITLE_REQUIRED: '请填写 300 字以内的商品名称',
    CATALOG_SKU_REQUIRED: '请填写 SKU 编码',
    CATALOG_CATEGORY_REQUIRED: '请填写类目标识或编码',
    CATALOG_ATTRIBUTES_INVALID: '商品属性必须是 JSON 对象',
    CATALOG_SPECIFICATIONS_INVALID: 'SKU 规格必须是 JSON 对象',
    CATALOG_IMAGES_INVALID: '图片必须是 1 至 20 个 HTTPS 地址组成的 JSON 数组',
    CATALOG_FIELD_TOO_LONG: '字段内容超过允许长度',
    VALIDATION_FAILED: 'SKU 编码格式不正确',
  });
  return messages[code ?? ''] ?? '该行未通过商品校验';
}

function missingAttribute(value: unknown): boolean {
  return value === undefined || value === null || value === '' || (Array.isArray(value) && value.length === 0);
}
function regions(attributes: Readonly<Record<string, unknown>>): readonly string[] {
  return Array.isArray(attributes.regionIds) ? Object.freeze(attributes.regionIds.filter((value): value is string => typeof value === 'string')) : Object.freeze([]);
}
function isKind(value: string): value is ProductDraft['kind'] {
  return ['physical', 'virtual', 'service', 'voucher'].includes(value);
}
function unique(values: readonly string[]): readonly string[] {
  return Object.freeze([...new Set(values)]);
}
function digest(value: string): string {
  return createHash('sha256').update(value).digest('hex').slice(0, 32);
}
function productId(scope: string, spu: string): string {
  return `product:import:${createHash('sha256').update(`${scope}:${spu}`).digest('hex')}`;
}
