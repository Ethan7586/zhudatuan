import { createHash } from 'node:crypto';
import { PgRuntimeWriter } from '../../../../platform/database/PgRuntimeWriter';
import type { SqlExecutor } from '../../../../platform/database/PgTransactionAccess';
import type { WriteTransactionContext } from '../../../../platform/database/TransactionContext';
import type { AuditPort } from '../../../audit/public';
import type { CatalogPartnerPort } from '../../../partner/public';
import type { ImportTarget } from '../../../runtime/public';
import { Product, type ProductSnapshot } from '../../domain/model/Product';
import { Sku } from '../../domain/model/Sku';
import { Category, type CategorySnapshot } from '../../domain/model/Category';

interface ImportReceipt {
  readonly product_id: string;
  readonly sku_id: string;
  readonly product_version: number | string;
  readonly sku_version: number | string;
  readonly source_hash: string;
}

interface ProductRecord extends Record<string, unknown> {
  readonly id: string;
  readonly scope_id: string;
  readonly owner_partner_id: string | null;
  readonly brand_id: string | null;
  readonly category_id: string;
  readonly title: string;
  readonly product_type: ProductSnapshot['kind'];
  readonly attributes: Readonly<Record<string, unknown>>;
  readonly status: ProductSnapshot['state'];
  readonly version: number | string;
}

export async function importProduct(database: SqlExecutor, context: WriteTransactionContext, target: ImportTarget, rowNumber: number, row: Readonly<Record<string, string>>, partners: CatalogPartnerPort, audit: AuditPort): Promise<void> {
  if (row.invalid) throw new Error(validCode(row.invalid) ? row.invalid : 'CATALOG_IMPORT_ROW_INVALID');
  const sourceHash = digest(JSON.stringify(row));
  const existingReceipt = await receipt(database, target.id, rowNumber);
  if (existingReceipt) return assertReceipt(existingReceipt, sourceHash);
  const spu = required(row.spu, 'CATALOG_SPU_REQUIRED', 128);
  const title = required(row.title, 'CATALOG_TITLE_REQUIRED', 300);
  const skuCode = Sku.normalizeCode(required(row.sku, 'CATALOG_SKU_REQUIRED', 128));
  const category = required(row.category, 'CATALOG_CATEGORY_REQUIRED', 128);
  const kind = productKind(row.type);
  const supplier = row.supplier?.trim() || null;
  const attributes = Object.freeze({ ...objectValue(row.attributes, 'CATALOG_ATTRIBUTES_INVALID'), sourceSpu: spu });
  const specifications = objectValue(row.specifications, 'CATALOG_SPECIFICATIONS_INVALID');
  const productId = importedId('product', target.scope, spu);
  const skuId = importedId('sku', target.scope, skuCode);
  await database.query(`select pg_advisory_xact_lock(hashtextextended(lock,0)) from unnest($1::text[]) lock order by lock`, [[productId, skuId].sort()]);
  const racedReceipt = await receipt(database, target.id, rowNumber);
  if (racedReceipt) return assertReceipt(racedReceipt, sourceHash);
  if (supplier !== null && !(await partners.scopes(context, [supplier])).has(supplier)) throw new Error('CATALOG_SUPPLIER_UNKNOWN');
  const selectedCategory = await activeCategory(database, category, attributes);
  const current = await database.query<ProductRecord>('select id,scope_id,owner_partner_id,brand_id,category_id,title,product_type,attributes,status,version from catalog.product where id=$1', [productId]);
  const existingProduct = current.rows[0];
  if (existingProduct?.status === 'archived') throw new Error('CATALOG_PRODUCT_ARCHIVED');
  const snapshot = Product.create({ id: productId, scope: target.scope, owner: supplier, brand: null, category: selectedCategory, title, kind, attributes }).snapshot();
  const product = await saveProduct(database, snapshot, existingProduct);
  const sku = await saveSku(database, target.scope, skuId, product.id, skuCode, specifications);
  const saved = await database.query<ImportReceipt>(
    `insert into catalog.import_receipts(import_id,scope_id,row_number,source_hash,product_id,sku_id,product_version,sku_version,created_at)
     values($1,$2,$3,$4,$5,$6,$7,$8,clock_timestamp()) on conflict(import_id,row_number) do nothing
     returning product_id,sku_id,product_version,sku_version,source_hash`,
    [target.id, target.scope, rowNumber, sourceHash, product.id, sku.id, product.version, sku.version]
  );
  if (!saved.rows[0]) {
    const raced = await receipt(database, target.id, rowNumber);
    if (!raced) throw new Error('CATALOG_IMPORT_RECEIPT_CONFLICT');
    return assertReceipt(raced, sourceHash);
  }
  if (product.changed)
    await new PgRuntimeWriter(database).appendMany([
      {
        id: `event:catalog:import:${digest(`${target.id}:${rowNumber}:product`)}`,
        type: product.created ? 'catalog.product.created' : 'catalog.product.updated',
        aggregateType: 'product',
        aggregate: product.id,
        aggregateVersion: product.version,
        scope: target.scope,
        payload: Object.freeze({ product: product.id, scope: target.scope, status: 'draft', version: product.version }),
        trace: target.id,
        actor: 'job:catalogimport',
        correlation: target.id,
        causation: `${target.id}:${rowNumber}`,
        payloadVersion: 1,
      },
    ]);
  await audit.record(context, {
    actor: 'job:catalogimport',
    actorType: 'service',
    scope: target.scope,
    request: `${target.id}:${rowNumber}`,
    operation: 'catalog.imports.apply',
    subject: { type: 'import', id: target.id },
    object: { type: 'product', id: product.id },
    outcome: 'succeeded',
    reason: '商品导入分片写入',
    before: existingProduct ?? null,
    after: { product: product.id, sku: sku.id, productVersion: product.version, skuVersion: sku.version },
    evidence: { sourceHash, fileHash: target.sha256, row: rowNumber },
    trace: target.id,
  });
}

async function saveProduct(database: SqlExecutor, value: ProductSnapshot, existing: ProductRecord | undefined) {
  const changed =
    !existing ||
    existing.scope_id !== value.scope ||
    existing.owner_partner_id !== value.owner ||
    existing.category_id !== value.category ||
    existing.title !== value.title ||
    existing.product_type !== value.kind ||
    JSON.stringify(existing.attributes) !== JSON.stringify(value.attributes);
  if (!changed && existing) return Object.freeze({ id: existing.id, version: Number(existing.version), created: false, changed: false });
  const result = await database.query<{ id: string; version: number | string }>(
    `insert into catalog.product(id,scope_id,owner_partner_id,brand_id,category_id,title,product_type,attributes,status,version,created_at,updated_at)
     values($1,$2,$3,null,$4,$5,$6,$7::jsonb,'draft',1,clock_timestamp(),clock_timestamp()) on conflict(id) do update set
     owner_partner_id=excluded.owner_partner_id,category_id=excluded.category_id,title=excluded.title,product_type=excluded.product_type,
     attributes=excluded.attributes,updated_at=clock_timestamp(),version=catalog.product.version+1 returning id,version`,
    [value.id, value.scope, value.owner, value.category, value.title, value.kind, JSON.stringify(value.attributes)]
  );
  if (!result.rows[0]) throw new Error('CATALOG_PRODUCT_IMPORT_FAILED');
  return Object.freeze({ id: result.rows[0].id, version: Number(result.rows[0].version), created: existing === undefined, changed: true });
}

async function saveSku(database: SqlExecutor, scope: string, id: string, product: string, code: string, specifications: Readonly<Record<string, unknown>>) {
  const current = await database.query<{ id: string; product_id: string; code: string; specifications: Readonly<Record<string, unknown>>; version: number | string }>(
    'select id,product_id,code,specifications,version from catalog.sku where id=$1 or scope_id=$2 and code=$3',
    [id, scope, code]
  );
  const existing = current.rows[0];
  if (existing && (existing.id !== id || existing.product_id !== product)) throw new Error('CATALOG_SKU_PRODUCT_CONFLICT');
  const changed = !existing || existing.code !== code || JSON.stringify(existing.specifications) !== JSON.stringify(specifications);
  if (!changed && existing) return Object.freeze({ id: existing.id, version: Number(existing.version) });
  const result = await database.query<{ id: string; version: number | string }>(
    `insert into catalog.sku(id,scope_id,product_id,code,specifications,status,version) values($1,$2,$3,$4,$5::jsonb,'draft',1)
     on conflict(id) do update set code=excluded.code,specifications=excluded.specifications,version=catalog.sku.version+1 returning id,version`,
    [id, scope, product, code, JSON.stringify(specifications)]
  );
  if (!result.rows[0]) throw new Error('CATALOG_SKU_IMPORT_FAILED');
  return Object.freeze({ id: result.rows[0].id, version: Number(result.rows[0].version) });
}

async function activeCategory(database: SqlExecutor, category: string, attributes: Readonly<Record<string, unknown>>): Promise<string> {
  const result = await database.query<{ id: string; parent_id: string | null; code: string; name: string; status: CategorySnapshot['state']; sort_order: number; required_attributes: readonly string[] }>(
    'select id,parent_id,code,name,status,sort_order,required_attributes from catalog.category where id=$1',
    [category]
  );
  const row = result.rows[0];
  if (!row) throw new Error('CATALOG_CATEGORY_UNKNOWN');
  const selected = Category.restore({ id: row.id, parent: row.parent_id, code: row.code, name: row.name, state: row.status, sort: row.sort_order }).active();
  if (row.required_attributes.some((key) => missing(attributes[key]))) throw new Error('CATALOG_ATTRIBUTE_REQUIRED');
  return selected.id;
}

async function receipt(database: SqlExecutor, importId: string, row: number): Promise<ImportReceipt | null> {
  const result = await database.query<ImportReceipt>('select product_id,sku_id,product_version,sku_version,source_hash from catalog.import_receipts where import_id=$1 and row_number=$2', [importId, row]);
  return result.rows[0] ?? null;
}

function assertReceipt(value: ImportReceipt, sourceHash: string): void {
  if (value.source_hash !== sourceHash) throw new Error('CATALOG_IMPORT_RECEIPT_CONFLICT');
}

function objectValue(value: string | undefined, code: string): Readonly<Record<string, unknown>> {
  let parsed: unknown;
  try {
    parsed = JSON.parse(value ?? '{}');
  } catch {
    throw new Error(code);
  }
  if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error(code);
  return Object.freeze({ ...(parsed as Readonly<Record<string, unknown>>) });
}

function required(value: string | undefined, code: string, maximum: number): string {
  const result = value?.trim() ?? '';
  if (!result || result.length > maximum) throw new Error(code);
  return result;
}

function productKind(value: string | undefined): ProductSnapshot['kind'] {
  const kind = value || 'physical';
  if (!['physical', 'virtual', 'service', 'voucher'].includes(kind)) throw new Error('CATALOG_PRODUCT_TYPE_INVALID');
  return kind as ProductSnapshot['kind'];
}

function importedId(kind: 'product' | 'sku', scope: string, value: string): string {
  return `${kind}:import:${createHash('sha256').update(`${scope}:${value}`).digest('hex')}`;
}

function missing(value: unknown): boolean {
  return value === undefined || value === null || value === '' || (Array.isArray(value) && value.length === 0);
}
function validCode(value: string): boolean {
  return /^[A-Z][A-Z0-9_]{2,127}$/.test(value);
}
function digest(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}
