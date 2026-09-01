import { randomUUID } from 'node:crypto';
import type { OperationDatabase } from '../../foundation/application/ModuleOperations';
import { Reservation, available } from './domain/model/Reservation';

export interface StockDemand {
  readonly sku: string;
  readonly listing: string;
  readonly stockitem: string | null;
  readonly quantity: number;
  readonly accepted: boolean;
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

  async expireCheckout(database: OperationDatabase, checkout: string): Promise<void> {
    await database.query(`update inventory.reservation set state='expired',version=version+1
      where owner_type='checkout' and owner_id=$1 and state='active'`, [checkout]);
  }
}

export const inventoryPort = new InventoryPort();
