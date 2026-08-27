import { createHash } from 'node:crypto';
import type { OperationDatabase } from '../../../foundation/application/ModuleOperations';

export async function importProduct(database: OperationDatabase, scope: string, row: Readonly<Record<string, string>>): Promise<void> {
  const title = required(row.title, 'CATALOG_TITLE_REQUIRED', 300);
  const skuCode = required(row.sku, 'CATALOG_SKU_REQUIRED', 128);
  const category = required(row.category, 'CATALOG_CATEGORY_REQUIRED', 128);
  const kind = row.type || 'physical';
  if (!['physical', 'virtual', 'service', 'voucher'].includes(kind)) throw new Error('CATALOG_PRODUCT_TYPE_INVALID');
  const selected = await database.query<{ id: string }>("select id from catalog.category where (id=$1 or code=$1) and status='active'", [category]);
  if (!selected.rows[0]) throw new Error('CATALOG_CATEGORY_UNKNOWN');
  const key = createHash('sha256').update(`${scope}:${skuCode}`).digest('hex');
  const product = `product:import:${key}`;
  const sku = `sku:import:${key}`;
  const attributes = attributesOf(row.attributes);
  await database.query(`insert into catalog.product(id,owner_partner_id,category_id,title,product_type,attributes,status,created_at,updated_at)
    values($1,$2,$3,$4,$5,$6::jsonb,'draft',clock_timestamp(),clock_timestamp()) on conflict(id) do update set
    category_id=excluded.category_id,title=excluded.title,product_type=excluded.product_type,attributes=excluded.attributes,
    updated_at=clock_timestamp(),version=catalog.product.version+1`,
  [product, scope, selected.rows[0].id, title, kind, JSON.stringify(attributes)]);
  await database.query(`insert into catalog.sku(id,product_id,code,specifications,status,version) values($1,$2,$3,'{}','draft',0)
    on conflict(id) do update set code=excluded.code,version=catalog.sku.version+1`, [sku, product, skuCode]);
}

function attributesOf(value: string | undefined): Readonly<Record<string, unknown>> {
  if (!value) return {};
  let parsed: unknown;
  try { parsed = JSON.parse(value); } catch { throw new Error('CATALOG_ATTRIBUTES_INVALID'); }
  if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error('CATALOG_ATTRIBUTES_INVALID');
  return parsed as Readonly<Record<string, unknown>>;
}

function required(value: string | undefined, code: string, maximum: number): string {
  if (!value || value.length > maximum) throw new Error(code);
  return value;
}
