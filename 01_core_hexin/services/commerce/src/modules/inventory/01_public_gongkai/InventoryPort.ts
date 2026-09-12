import { createHash, randomUUID } from 'node:crypto';
import type { OperationDatabase } from '../../../foundation/application/ModuleOperations';
import { Reservation, available } from '../02_domain_yewu/model/Reservation';

export interface StockDemand {
  readonly sku: string;
  readonly listing: string;
  readonly stockitem: string | null;
  readonly quantity: number;
  readonly accepted: boolean;
}

export interface CatalogPackageStock {
  readonly scope: string;
  readonly sku: string;
  readonly available: number;
  readonly sourceVersion: string;
}

export class InventoryPort {
  async observe(database: OperationDatabase, input: Readonly<{ id: string; scope: string; sku: string; location: string;
    onhand: number; safety: number; provider: string; version: string }>): Promise<void> {
    await database.query(`insert into inventory.stockitem(id,scope_id,sku_id,location_id,onhand,safety,version,status,updated_at)
      values($1,$2,$3,$4,$5,$6,0,'active',clock_timestamp()) on conflict(scope_id,sku_id,location_id) do update
      set onhand=excluded.onhand,safety=excluded.safety,version=inventory.stockitem.version+1,status='active',updated_at=clock_timestamp()`,
    [input.id, input.scope, input.sku, input.location, input.onhand, input.safety]);
    await database.query(`insert into inventory.snapshot(stockitem_id,observed_at,source,onhand,source_version)
      values($1,clock_timestamp(),$2,$3,$4)`, [input.id, input.provider, input.onhand, input.version]);
  }

  async upsertCatalogPackageStock(database: OperationDatabase, input: CatalogPackageStock): Promise<void> {
    const proposed = `stock:catalog-package:${digest(`${input.scope}:${input.sku}`)}`;
    const saved = await database.query<{ id: string }>(`insert into inventory.stockitem(id,scope_id,sku_id,location_id,onhand,safety,version,status,updated_at)
      values($1,$2,$3,'catalog-package', $4,0,0,'active',clock_timestamp())
      on conflict(scope_id,sku_id,location_id) do update set onhand=excluded.onhand,safety=0,
      version=inventory.stockitem.version+1,status='active',updated_at=clock_timestamp() returning id`,
    [proposed, input.scope, input.sku, input.available]);
    const stock = saved.rows[0]?.id;
    if (!stock) throw new Error('INVENTORY_STOCK_WRITE_FAILED');
    await database.query(`insert into inventory.snapshot(stockitem_id,observed_at,source,onhand,source_version)
      select $1,clock_timestamp(),'catalog-package/v1',$2,$3 where not exists(
        select 1 from inventory.snapshot where stockitem_id=$1 and source='catalog-package/v1' and source_version=$3)`,
    [stock, input.available, input.sourceVersion]);
  }

  async reserve(database: OperationDatabase, order: string, mall: string, demand: readonly StockDemand[]): Promise<void> {
    const lines = demand.filter(({ accepted }) => accepted).sort((left, right) => left.sku.localeCompare(right.sku) || left.listing.localeCompare(right.listing));
    const ids = [...new Set(lines.map(({ stockitem }) => stockitem).filter((id): id is string => id !== null))];
    const locked = await database.query<{ id: string; onhand: number; safety: number; reserved: number }>(`with locked as(
      select stock.id,stock.onhand,stock.safety from inventory.stockitem stock
      where stock.id=any($1::text[]) and stock.scope_id=$2 and stock.status='active'
      order by array_position($1::text[],stock.id) for update)
      select locked.id,locked.onhand::float8 onhand,locked.safety::float8 safety,coalesce((select sum(reservation.quantity)
        from inventory.reservation reservation where reservation.mall_id=$2 and reservation.stockitem_id=locked.id
          and reservation.state='active' and reservation.expires_at>clock_timestamp()),0)::float8 reserved
      from locked order by array_position($1::text[],locked.id)`, [ids, mall]);
    const stocks = new Map(locked.rows.map((row) => [row.id, row]));
    for (const line of lines) {
      const stock = line.stockitem === null ? undefined : stocks.get(line.stockitem);
      if (!stock || available(stock.onhand, stock.reserved, stock.safety) < line.quantity) throw new Error('INVENTORY_INSUFFICIENT');
      const reservation = new Reservation(`reservation:${randomUUID()}`, line.quantity);
      await database.query(`insert into inventory.reservation(id,mall_id,stockitem_id,owner_type,owner_id,quantity,state,expires_at,created_at,version)
        values($1,$2,$3,'order',$4,$5,$6,clock_timestamp()+interval '30 minutes',clock_timestamp(),0)`,
      [reservation.id, mall, stock.id, order, reservation.quantity, reservation.state]);
      await database.query(`insert into inventory.movement(id,mall_id,stockitem_id,kind,quantity_delta,reference_type,reference_id,occurred_at)
        values($1,$2,$3,'reserve',$4,'order',$5,clock_timestamp())`, [`movement:${randomUUID()}`, mall, stock.id, -line.quantity, order]);
      stock.reserved += line.quantity;
    }
  }

  async commit(database: OperationDatabase, mall: string, order: string): Promise<void> {
    const reservations = await database.query<{ id: string; stockitem_id: string; quantity: number }>(`select id,stockitem_id,quantity::float8 quantity
      from inventory.reservation where mall_id=$1 and owner_type='order' and owner_id=$2 and state='active'
      order by stockitem_id for update`, [mall, order]);
    for (const reservation of reservations.rows) {
      const stock = await database.query(`update inventory.stockitem set onhand=onhand-$2,version=version+1,updated_at=clock_timestamp()
        where scope_id=$3 and id=$1 and onhand-safety>=$2 returning id`, [reservation.stockitem_id, reservation.quantity, mall]);
      if (!stock.rows[0]) throw new Error('INVENTORY_COMMIT_CONFLICT');
      await database.query(`update inventory.reservation set state='committed',version=version+1 where mall_id=$1 and id=$2`, [mall, reservation.id]);
      await database.query(`insert into inventory.movement(id,mall_id,stockitem_id,kind,quantity_delta,reference_type,reference_id,occurred_at)
        values($1,$2,$3,'commit',$4,'order',$5,clock_timestamp())
        on conflict(mall_id,stockitem_id,kind,reference_type,reference_id) do nothing`,
      [`movement:${randomUUID()}`, mall, reservation.stockitem_id, -reservation.quantity, order]);
    }
  }

  async release(database: OperationDatabase, mall: string, order: string): Promise<void> {
    const reservations = await database.query<{ stockitem_id: string; quantity: number }>(`update inventory.reservation
      set state='released',version=version+1 where mall_id=$1 and owner_type='order' and owner_id=$2 and state='active'
      returning stockitem_id,quantity::float8 quantity`, [mall, order]);
    for (const item of reservations.rows) await database.query(`insert into inventory.movement
      (id,mall_id,stockitem_id,kind,quantity_delta,reference_type,reference_id,occurred_at)
      values($1,$2,$3,'release',$4,'order',$5,clock_timestamp())
      on conflict(mall_id,stockitem_id,kind,reference_type,reference_id) do nothing`,
    [`movement:${randomUUID()}`, mall, item.stockitem_id, item.quantity, order]);
  }

  async restockSupplierAftersale(database: OperationDatabase, aftersale: string): Promise<void> {
    const target = (await database.query<{ line_id: string; supplier_leg_id: string; stockitem_id: string; transaction_id: string;
      correlation_id: string; route_id: string; route_version: number; quantity: number; ordered_quantity: number; mall_id: string }>(
      `select line.id line_id,line.supplier_leg_id,line.stockitem_id,orders.transaction_id,orders.correlation_id,line.route_id,
        line.route_version::float8 route_version,coalesce(aftersale.quantity,line.quantity)::float8 quantity,
        line.quantity::float8 ordered_quantity,orders.mall_id
      from ordering.aftersale aftersale join ordering.orderrecord orders on orders.id=aftersale.order_id
      join ordering.line line on line.id=aftersale.line_id and line.order_id=orders.id
      where aftersale.id=$1 for update of line`, [aftersale])).rows[0];
    if (!target || !target.supplier_leg_id || !target.stockitem_id) throw new Error('SUPPLIER_AFTERSALE_STOCK_TARGET_MISSING');
    const prior = await database.query<{ quantity: number }>(`select coalesce(sum(quantity),0)::float8 quantity
      from inventory.supplierrestockfact where order_line_id=$1`, [target.line_id]);
    const already = prior.rows[0]?.quantity ?? 0;
    const existing = await database.query(`select 1 from inventory.supplierrestockfact where aftersale_id=$1 and order_line_id=$2`,
    [aftersale, target.line_id]);
    if (existing.rows[0]) return;
    if (already+target.quantity>target.ordered_quantity) throw new Error('SUPPLIER_AFTERSALE_QUANTITY_EXCEEDS_LINE');
    const inserted = await database.query(`insert into inventory.supplierrestockfact(id,aftersale_id,order_line_id,supplier_leg_id,stockitem_id,
      transaction_id,correlation_id,route_id,route_version,quantity,created_at)
      values('supplier-restock:'||$1,$1,$2,$3,$4,$5,$6,$7,$8,$9,clock_timestamp()) on conflict(aftersale_id,order_line_id) do nothing returning id`,
    [aftersale,target.line_id,target.supplier_leg_id,target.stockitem_id,target.transaction_id,target.correlation_id,target.route_id,
      target.route_version,target.quantity]);
    if (!inserted.rows[0]) return;
    await database.query(`update inventory.stockitem set onhand=onhand+$2,version=version+1,updated_at=clock_timestamp()
      where id=$1 and scope_id=$3`, [target.stockitem_id,target.quantity,target.mall_id]);
    await database.query(`insert into inventory.movement(id,mall_id,stockitem_id,kind,quantity_delta,reference_type,reference_id,occurred_at)
      values('movement:supplier-return:'||$1,$2,$3,'return',$4,'supplier_aftersale',$1,clock_timestamp())
      on conflict(mall_id,stockitem_id,kind,reference_type,reference_id) do nothing`,
    [aftersale,target.mall_id,target.stockitem_id,target.quantity]);
  }

  async expireCheckout(database: OperationDatabase, checkout: string): Promise<void> {
    await database.query(`update inventory.reservation set state='expired',version=version+1
      where owner_type='checkout' and owner_id=$1 and state='active'`, [checkout]);
  }
}

export const inventoryPort = new InventoryPort();

function digest(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}
