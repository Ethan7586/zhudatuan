import { createHash } from 'node:crypto';
import type { SqlExecutor } from '../../../../platform/database/PgTransactionAccess';
import type { CatalogSku } from '../../../catalog/public';
import { StockItem, type StockItemState } from '../../domain/model/StockItem';

export interface StockImportResult {
  readonly stockitem: string;
  readonly sku: string;
  readonly available: number;
  readonly reserved: number;
  readonly version: number;
}

export async function importStock(database: SqlExecutor, catalog: CatalogSku, scope: string, importid: string, rowNumber: number, row: Readonly<Record<string, string>>): Promise<StockImportResult | null> {
  const skuReference = required(row.sku, 'INVENTORY_SKU_REQUIRED', 128);
  const location = required(row.location, 'INVENTORY_LOCATION_REQUIRED', 128);
  const onhand = quantity(row.onhand, 'INVENTORY_ONHAND_INVALID');
  const safety = row.safety ? quantity(row.safety, 'INVENTORY_SAFETY_INVALID') : 0;
  const status = (row.status || 'active') as StockItemState;
  if (!['active', 'blocked'].includes(status)) throw new Error('INVENTORY_STATUS_INVALID');
  const sku = await catalog.find(database.transaction, scope, skuReference);
  if (!sku) throw new Error('INVENTORY_SKU_UNKNOWN');
  const identity = createHash('sha256').update(`${scope}:${sku}:${location}`).digest('hex');
  const id = `stock:import:${identity}`;
  const selected = await database.query<{
    id: string;
    scope_id: string;
    sku_id: string;
    location_id: string;
    onhand: number;
    safety: number;
    status: StockItemState;
    version: number;
    updated_at: Date | string;
    reserved: number;
  }>(
    `select stock.id,stock.scope_id,stock.sku_id,stock.location_id,stock.onhand::float8 onhand,stock.safety::float8 safety,
     stock.status,stock.version::integer,stock.updated_at,coalesce(reservation.quantity,0)::float8 reserved
     from inventory.stockitem stock left join lateral(select sum(value.quantity) quantity from inventory.reservation value
       where value.stockitem_id=stock.id and value.state='reserved' and value.expires_at>clock_timestamp()) reservation on true
     where stock.scope_id=$1 and stock.sku_id=$2 and stock.location_id=$3 for update of stock`,
    [scope, sku, location]
  );
  const now = new Date().toISOString();
  const existing = selected.rows[0];
  const stock = existing
    ? StockItem.restore({
        id: existing.id,
        scope: existing.scope_id,
        sku: existing.sku_id,
        location: existing.location_id,
        onhand: Number(existing.onhand),
        safety: Number(existing.safety),
        state: existing.status,
        version: Number(existing.version),
        updatedAt: iso(existing.updated_at),
      })
    : StockItem.create({ id, scope, sku, location, onhand, safety, state: status, updatedAt: now });
  if (existing && status === 'active' && onhand < Number(existing.reserved) + safety) throw new Error('INVENTORY_IMPORT_BELOW_COMMITMENT');
  if (!existing) {
    const value = stock.snapshot();
    await database.query(
      `insert into inventory.stockitem(id,scope_id,sku_id,location_id,onhand,safety,status,version,updated_at)
      values($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
      [value.id, value.scope, value.sku, value.location, value.onhand, value.safety, value.state, value.version, value.updatedAt]
    );
  }
  const reference = `${importid}:${rowNumber}`;
  const observed = await database.query(
    `insert into inventory.observation(id,stockitem_id,kind,source,source_reference,observed_onhand,observed_quantity,disposition,evidence,observed_at,recorded_at)
     values($1,$2,'stock','import',$3,$4,null,'accepted',$5::jsonb,$6,$6)
     on conflict(stockitem_id,kind,source,source_reference) do nothing returning id`,
    [`observation:${createHash('sha256').update(`${stock.snapshot().id}:${reference}`).digest('hex')}`, stock.snapshot().id, reference, onhand, JSON.stringify({ import: importid, row: rowNumber, safety, status }), now]
  );
  if (!observed.rows[0]) return null;
  await database.query(
    `insert into inventory.snapshot(stockitem_id,observed_at,source,onhand,source_version) values($1,$2,'import',$3,$4)
     on conflict(stockitem_id,source,source_version) do nothing`,
    [stock.snapshot().id, now, onhand, reference]
  );
  const next = existing ? stock.observe({ onhand, safety, state: status, at: now }, Number(existing.reserved)) : stock;
  const delta = onhand - (existing?.onhand ?? 0);
  if (delta !== 0) {
    await database.query(
      `insert into inventory.movement(id,stockitem_id,kind,quantity_delta,reference_type,reference_id,occurred_at)
       values($1,$2,'adjust',$3,'import',$4,$5) on conflict(stockitem_id,kind,reference_type,reference_id) do nothing`,
      [`movement:import:${createHash('sha256').update(`${stock.snapshot().id}:${reference}`).digest('hex')}`, stock.snapshot().id, delta, reference, now]
    );
  }
  if (existing && next !== stock) {
    const value = next.snapshot();
    const updated = await database.query(
      `update inventory.stockitem set onhand=$2,safety=$3,status=$4,version=$5,updated_at=$6
      where id=$1 and version=$7 returning id`,
      [value.id, value.onhand, value.safety, value.state, value.version, value.updatedAt, stock.snapshot().version]
    );
    if (!updated.rows[0]) throw new Error('INVENTORY_IMPORT_VERSION_CONFLICT');
  }
  const value = next.snapshot();
  const reserved = Number(existing?.reserved ?? 0);
  return Object.freeze({ stockitem: value.id, sku: value.sku, available: value.state === 'active' ? Math.max(0, value.onhand - value.safety - reserved) : 0, reserved, version: value.version });
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
function iso(value: Date | string): string {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) throw new Error('INVENTORY_TIME_INVALID');
  return date.toISOString();
}
