import { createHash } from 'node:crypto';
import type { OperationDatabase } from '../../../foundation/application/ModuleOperations';
import type { CatalogSku } from '../../catalog/public/index';

export async function importStock(database: OperationDatabase, catalog: CatalogSku, scope: string, importid: string, rowNumber: number, row: Readonly<Record<string, string>>): Promise<void> {
  const skuReference = required(row.sku, 'INVENTORY_SKU_REQUIRED', 128);
  const location = required(row.location, 'INVENTORY_LOCATION_REQUIRED', 128);
  const onhand = quantity(row.onhand, 'INVENTORY_ONHAND_INVALID');
  const safety = row.safety ? quantity(row.safety, 'INVENTORY_SAFETY_INVALID') : 0;
  const status = row.status || 'active';
  if (!['active', 'blocked'].includes(status)) throw new Error('INVENTORY_STATUS_INVALID');
  const sku = await catalog.find(database, scope, skuReference);
  if (!sku) throw new Error('INVENTORY_SKU_UNKNOWN');
  const identity = createHash('sha256').update(`${scope}:${sku}:${location}`).digest('hex');
  const id = `stock:import:${identity}`;
  const existing = await database.query<{ id: string; onhand: string }>(
    `select id,onhand::text from inventory.stockitem
    where scope_id=$1 and sku_id=$2 and location_id=$3 for update`,
    [scope, sku, location]
  );
  if (!existing.rows[0]) {
    await database.query(
      `insert into inventory.stockitem(id,scope_id,sku_id,location_id,onhand,safety,status,updated_at)
      values($1,$2,$3,$4,$5,$6,$7,clock_timestamp())`,
      [id, scope, sku, location, onhand, safety, status]
    );
    if (onhand > 0) await movement(database, id, onhand, importid, rowNumber);
    return;
  }
  const reserved = await database.query<{ quantity: string }>(
    `select coalesce(sum(quantity),0)::text quantity from inventory.reservation
    where stockitem_id=$1 and state='reserved' and expires_at>clock_timestamp()`,
    [existing.rows[0].id]
  );
  if (onhand < Number(reserved.rows[0]?.quantity ?? 0) + safety) throw new Error('INVENTORY_IMPORT_BELOW_COMMITMENT');
  const delta = onhand - Number(existing.rows[0].onhand);
  if (delta !== 0 && !(await movement(database, existing.rows[0].id, delta, importid, rowNumber))) return;
  await database.query(
    `update inventory.stockitem set onhand=$2,safety=$3,status=$4,version=version+1,updated_at=clock_timestamp()
    where id=$1`,
    [existing.rows[0].id, onhand, safety, status]
  );
}

async function movement(database: OperationDatabase, stock: string, delta: number, importid: string, row: number): Promise<boolean> {
  const reference = `${importid}:${row}`;
  const result = await database.query(
    `insert into inventory.movement(id,stockitem_id,kind,quantity_delta,reference_type,reference_id,occurred_at)
    values($1,$2,'adjust',$3,'import',$4,clock_timestamp()) on conflict(stockitem_id,kind,reference_type,reference_id) do nothing returning id`,
    [`movement:import:${createHash('sha256').update(`${stock}:${reference}`).digest('hex')}`, stock, delta, reference]
  );
  return Boolean(result.rows[0]);
}

function quantity(value: string | undefined, code: string): number {
  if (!value || !/^(0|[1-9][0-9]{0,14})$/.test(value)) throw new Error(code);
  const result = Number(value);
  if (!Number.isSafeInteger(result)) throw new Error(code);
  return result;
}

function required(value: string | undefined, code: string, maximum: number): string {
  if (!value || value.length > maximum) throw new Error(code);
  return value;
}
