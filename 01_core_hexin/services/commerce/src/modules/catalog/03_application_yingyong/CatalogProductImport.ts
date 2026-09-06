import { createHash } from 'node:crypto';
import type { OperationDatabase } from '../../../foundation/application/ModuleOperations';
import { inventoryPort } from '../../inventory';
import { pricingPort } from '../../pricing';

export interface CatalogImportFailure {
  readonly reason: string;
  readonly field: string | null;
  readonly detail: string;
}

export interface ImportedCatalogFacts {
  readonly product: string;
  readonly sku: string;
  readonly listing: string;
}

interface PreparedCatalogProduct {
  readonly title: string;
  readonly kind: string;
  readonly skuCode: string;
  readonly categoryId: string;
  readonly product: string;
  readonly sku: string;
  readonly listing: string;
  readonly attributes: Readonly<Record<string, unknown>>;
  readonly specifications: Readonly<Record<string, unknown>>;
  readonly amountMinor: number;
  readonly compareMinor: number | null;
  readonly availableStock: number;
  readonly sourceVersion: string;
}

export async function validateCatalogProduct(
  database: OperationDatabase,
  scope: string,
  row: Readonly<Record<string, string>>,
  seenSkuCodes?: Set<string>,
): Promise<void> {
  await prepareCatalogProduct(database, scope, '', 0, row, seenSkuCodes);
}

export async function importProduct(
  database: OperationDatabase,
  scope: string,
  importId: string,
  rowNumber: number,
  row: Readonly<Record<string, string>>,
): Promise<ImportedCatalogFacts> {
  const prepared = await prepareCatalogProduct(database, scope, importId, rowNumber, row);
  await database.query(`insert into catalog.product(id,owner_partner_id,category_id,title,product_type,attributes,status,version,created_at,updated_at)
    values($1,null,$2,$3,$4,$5::jsonb,'active',0,clock_timestamp(),clock_timestamp())
    on conflict(id) do update set category_id=excluded.category_id,title=excluded.title,product_type=excluded.product_type,
      attributes=excluded.attributes,status='active',version=catalog.product.version+1,updated_at=clock_timestamp()`,
  [prepared.product, prepared.categoryId, prepared.title, prepared.kind, JSON.stringify(prepared.attributes)]);
  await database.query(`insert into catalog.sku(id,product_id,code,specifications,status,version)
    values($1,$2,$3,$4::jsonb,'active',0)`, [prepared.sku, prepared.product, prepared.skuCode, JSON.stringify(prepared.specifications)]);
  await database.query(`insert into catalog.listing(id,scope_id,pool_id,sku_id,title,status,effective_at,expires_at,version,created_at,updated_at)
    values($1,$2,null,$3,$4,'draft',null,null,0,clock_timestamp(),clock_timestamp())`,
  [prepared.listing, scope, prepared.sku, prepared.title]);
  await pricingPort.upsertCatalogPackageOffer(database, {
    scope, sku: prepared.sku, amountMinor: prepared.amountMinor, compareMinor: prepared.compareMinor, sourceVersion: prepared.sourceVersion,
  });
  await inventoryPort.upsertCatalogPackageStock(database, {
    scope, sku: prepared.sku, available: prepared.availableStock, sourceVersion: prepared.sourceVersion,
  });
  return Object.freeze({ product: prepared.product, sku: prepared.sku, listing: prepared.listing });
}

async function prepareCatalogProduct(
  database: OperationDatabase,
  scope: string,
  importId: string,
  rowNumber: number,
  row: Readonly<Record<string, string>>,
  seenSkuCodes?: Set<string>,
): Promise<PreparedCatalogProduct> {
  validateCompiledItem(row);
  const title = required(row.title, 'CATALOG_TITLE_REQUIRED', 'product.title', 300);
  const description = required(row.description, 'CATALOG_DESCRIPTION_REQUIRED', 'product.description', 5_000);
  const skuCode = required(row.sku, 'CATALOG_SKU_REQUIRED', 'sku.code', 128);
  const category = required(row.category, 'CATALOG_CATEGORY_REQUIRED', 'product.category', 128);
  const kind = row.type || 'physical';
  if (!['physical', 'virtual', 'service', 'voucher'].includes(kind)) {
    fail('CATALOG_PRODUCT_TYPE_INVALID', 'product.type', '商品类型必须是 physical、virtual、service 或 voucher');
  }
  if (row.currency !== 'CNY') fail('CATALOG_CURRENCY_INVALID', 'offer.currency', '售价币种必须是 CNY');
  const amountMinor = quantity(row.priceMinor, 'CATALOG_PRICE_INVALID', 'offer.amountMinor');
  const compareMinor = row.compareMinor ? quantity(row.compareMinor, 'CATALOG_COMPARE_PRICE_INVALID', 'offer.compareMinor') : null;
  if (compareMinor !== null && compareMinor < amountMinor) {
    fail('CATALOG_COMPARE_PRICE_INVALID', 'offer.compareMinor', '划线价不得低于售价');
  }
  const availableStock = quantity(row.stock, 'CATALOG_STOCK_INVALID', 'inventory.available');
  if (!['draft', 'pending_listing'].includes(row.status || 'draft')) {
    fail('CATALOG_PUBLICATION_STATE_INVALID', 'publication.state', '标准包只能进入待上架状态');
  }
  const attributes = objectCell(row.attributes, 'CATALOG_ATTRIBUTES_INVALID', 'product.attributes');
  const specifications = objectCell(row.specifications, 'CATALOG_SPECIFICATIONS_INVALID', 'sku.specifications');
  const sourceTrace = objectCell(row.sourceTrace, 'CATALOG_SOURCE_TRACE_INVALID', 'source');
  const packageSource = objectCell(row.packageSource, 'CATALOG_PACKAGE_SOURCE_INVALID', 'source');
  const packageId = required(row.packageId, 'CATALOG_PACKAGE_ID_INVALID', 'packageId', 128);
  const sourceRow = quantity(row.sourceRow, 'CATALOG_SOURCE_ROW_INVALID', 'source.row');
  const productReference = traceReference(sourceTrace, ['productRef', 'externalProductId', 'spu'], 'source.productRef');
  const skuReference = traceReference(sourceTrace, ['skuRef', 'externalSkuId'], 'source.skuRef');
  const media = mediaCell(row.media);

  if (seenSkuCodes?.has(skuCode)) fail('CATALOG_SKU_DUPLICATE', 'sku.code', '标准包内 SKU 编码重复');

  const selected = await database.query<{ id: string }>("select id from catalog.category where (id=$1 or code=$1) and status='active'", [category]);
  if (!selected.rows[0]) fail('CATALOG_CATEGORY_UNKNOWN', 'product.category', '分类不存在或未启用');
  const duplicate = await database.query<{ id: string }>('select id from catalog.sku where code=$1 limit 1', [skuCode]);
  if (duplicate.rows[0]) fail('CATALOG_SKU_DUPLICATE', 'sku.code', 'SKU 编码已存在，未生成重复商品');
  seenSkuCodes?.add(skuCode);

  const product = `product:package:${digest(`${scope}:${String(packageSource.name ?? '')}:${productReference}`)}`;
  const sku = `sku:package:${digest(`${scope}:${String(packageSource.name ?? '')}:${skuReference}:${skuCode}`)}`;
  const listing = `listing:package:${digest(`${scope}:${sku}`)}`;
  const coverUrl = media.find((item) => typeof item.url === 'string')?.url;
  const persistedAttributes = {
    ...attributes,
    description,
    media,
    ...(coverUrl === undefined ? {} : { coverUrl }),
    packageSource,
    sourceTrace: { ...sourceTrace, packageId, sourceRow, importId, rowNumber },
  };
  const sourceVersion = `${row.packageSha ?? packageId}:${sourceRow}`;
  return Object.freeze({
    title, kind, skuCode, categoryId: selected.rows[0].id, product, sku, listing, attributes: persistedAttributes,
    specifications, amountMinor, compareMinor, availableStock, sourceVersion,
  });
}

export function catalogImportFailure(cause: unknown): CatalogImportFailure {
  if (cause instanceof CatalogRowError) return { reason: cause.code, field: cause.field, detail: cause.detail };
  const detail = (cause instanceof Error ? cause.message : '商品行导入失败').replace(/[\r\n\t]/g, ' ').slice(0, 500);
  return { reason: detail.replace(/[^A-Z0-9_:.-]/g, '_').slice(0, 100) || 'CATALOG_IMPORT_ROW_FAILED', field: null, detail };
}

function validateCompiledItem(row: Readonly<Record<string, string>>): void {
  if (row.packageError) fail(row.packageError, null, '标准包中的商品行不是对象');
  const validation = objectCell(row.validation, 'CATALOG_ITEM_VALIDATION_INVALID', 'validation');
  if (validation.status !== 'valid') {
    const first = Array.isArray(validation.errors) && validation.errors[0] !== null && typeof validation.errors[0] === 'object'
      ? validation.errors[0] as Readonly<Record<string, unknown>> : {};
    fail(
      typeof first.code === 'string' && first.code ? first.code : 'CATALOG_ITEM_COMPILE_FAILED',
      typeof first.field === 'string' && first.field ? first.field : 'validation',
      typeof first.message === 'string' && first.message ? first.message : '该来源行未通过货盘编译校验',
    );
  }
}

function mediaCell(value: string | undefined): readonly Readonly<Record<string, string>>[] {
  let parsed: unknown;
  try { parsed = JSON.parse(value || '[]'); } catch { fail('CATALOG_MEDIA_INVALID', 'product.media', '媒体字段必须是数组'); }
  if (!Array.isArray(parsed) || parsed.length === 0) fail('CATALOG_MEDIA_REQUIRED', 'product.media', '至少提供一个图片 URL 或正式媒体引用');
  return Object.freeze(parsed.map((entry) => {
    if (entry === null || typeof entry !== 'object' || Array.isArray(entry)) {
      fail('CATALOG_MEDIA_INVALID', 'product.media', '媒体项必须是对象');
    }
    const item = entry as Readonly<Record<string, unknown>>;
    const kind = item.kind === undefined ? 'image' : String(item.kind);
    if (kind !== 'image') fail('CATALOG_MEDIA_KIND_INVALID', 'product.media.kind', '第一版只支持 image 媒体');
    const url = typeof item.url === 'string' ? item.url.trim() : '';
    const reference = typeof item.reference === 'string' ? item.reference.trim() : '';
    if (!url && !reference) fail('CATALOG_MEDIA_REFERENCE_REQUIRED', 'product.media', '媒体项必须包含 url 或 reference');
    if (url) validateImageUrl(url);
    if (reference.length > 2_048) fail('CATALOG_MEDIA_REFERENCE_INVALID', 'product.media.reference', '媒体引用过长');
    return Object.freeze({ kind, ...(url ? { url } : {}), ...(reference ? { reference } : {}) });
  }));
}

function validateImageUrl(value: string): void {
  let url: URL;
  try { url = new URL(value); } catch { fail('CATALOG_IMAGE_URL_INVALID', 'product.media.url', '图片 URL 无效'); }
  if (url.protocol !== 'https:' || url.hostname === 'picsum.photos' || url.hostname.endsWith('.picsum.photos')) {
    fail('CATALOG_IMAGE_URL_INVALID', 'product.media.url', '图片必须使用正式 HTTPS 地址，不能使用 picsum 占位图');
  }
}

function objectCell(value: string | undefined, code: string, field: string): Readonly<Record<string, unknown>> {
  let parsed: unknown;
  try { parsed = JSON.parse(value || '{}'); } catch { fail(code, field, `${field} 必须是 JSON 对象`); }
  if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) fail(code, field, `${field} 必须是 JSON 对象`);
  return parsed as Readonly<Record<string, unknown>>;
}

function traceReference(source: Readonly<Record<string, unknown>>, keys: readonly string[], field: string): string {
  for (const key of keys) if (typeof source[key] === 'string' && source[key] !== '') return String(source[key]);
  fail('CATALOG_SOURCE_REFERENCE_REQUIRED', field, `${field} 必填`);
}

function quantity(value: string | undefined, code: string, field: string): number {
  if (!value || !/^(0|[1-9][0-9]{0,14})$/.test(value)) fail(code, field, `${field} 必须是非负整数`);
  const result = Number(value);
  if (!Number.isSafeInteger(result)) fail(code, field, `${field} 超出可支持范围`);
  return result;
}

function required(value: string | undefined, code: string, field: string, maximum: number): string {
  const normalized = value?.trim() ?? '';
  if (!normalized || normalized.length > maximum) fail(code, field, `${field} 必填且长度不能超过 ${maximum}`);
  return normalized;
}

function digest(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}

function fail(code: string, field: string | null, detail: string): never {
  throw new CatalogRowError(code, field, detail);
}

class CatalogRowError extends Error {
  constructor(readonly code: string, readonly field: string | null, readonly detail: string) {
    super(code);
    this.name = 'CatalogRowError';
  }
}
