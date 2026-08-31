import { DomainError } from '../../foundation/domain/DomainError';
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
  async availability(database: OperationDatabase, scope: string, skus: readonly string[]) {
    if (skus.length === 0) return Object.freeze([]);
    const result = await database.query<{ sku: string; stockitem: string; onhand: number; safety: number; reserved: number; version: number }>(
      `select distinct on(stock.sku_id) stock.sku_id sku,stock.id stockitem,stock.onhand::float8 onhand,
      stock.safety::float8 safety,coalesce(sum(reservation.quantity) filter(where reservation.state='reserved'
      and reservation.expires_at>clock_timestamp()),0)::float8 reserved,stock.version::integer version
      from inventory.stockitem stock left join inventory.reservation reservation on reservation.stockitem_id=stock.id
      where stock.scope_id=$1 and stock.sku_id=any($2::text[]) and stock.status='active'
      group by stock.id order by stock.sku_id,
      stock.onhand-stock.safety-coalesce(sum(reservation.quantity) filter(where reservation.state='reserved'
      and reservation.expires_at>clock_timestamp()),0) desc,stock.id`,
      [scope, skus]
    );
    return Object.freeze(result.rows.map((row) => Object.freeze(row)));
  }

  async stock(database: OperationDatabase, skus: readonly string[], scopes: readonly string[]): Promise<readonly Readonly<Record<string, unknown>>[]> {
    if (skus.length === 0 || scopes.length === 0) return Object.freeze([]);
    const result = await database.query(
      `select sku_id sku,scope_id scope,location_id location,onhand::text onhand,safety::text safety,
      status,version::text version from inventory.stockitem where sku_id=any($1::text[]) and scope_id=any($2::text[])
      order by scope_id,location_id,sku_id`,
      [skus, scopes]
    );
    return Object.freeze(result.rows.map((row) => Object.freeze(row)));
  }

  async observe(database: OperationDatabase, input: Readonly<{ id: string; scope: string; sku: string; location: string; onhand: number; safety: number; provider: string; version: string }>): Promise<void> {
    await database.query(
      `insert into inventory.stockitem(id,scope_id,sku_id,location_id,onhand,safety,version,status,updated_at)
      values($1,$2,$3,$4,$5,$6,0,'active',clock_timestamp()) on conflict(scope_id,sku_id,location_id) do update
      set onhand=excluded.onhand,safety=excluded.safety,version=inventory.stockitem.version+1,status='active',updated_at=clock_timestamp()`,
      [input.id, input.scope, input.sku, input.location, input.onhand, input.safety]
    );
    await database.query(
      `insert into inventory.snapshot(stockitem_id,observed_at,source,onhand,source_version)
      values($1,clock_timestamp(),$2,$3,$4)`,
      [input.id, input.provider, input.onhand, input.version]
    );
  }

  async reserve(database: OperationDatabase, order: string, scope: string, demand: readonly StockDemand[]): Promise<void> {
    const lines = demand.filter(({ accepted }) => accepted).sort((left, right) => left.sku.localeCompare(right.sku) || left.listing.localeCompare(right.listing));
    const ids = [...new Set(lines.map(({ stockitem }) => stockitem).filter((id): id is string => id !== null))];
    const locked = await database.query<{ id: string; onhand: number; safety: number; reserved: number }>(
      `with locked as(
      select stock.id,stock.onhand,stock.safety from inventory.stockitem stock
      where stock.id=any($1::text[]) and stock.scope_id=$2 and stock.status='active'
      order by array_position($1::text[],stock.id) for update)
      select locked.id,locked.onhand::float8 onhand,locked.safety::float8 safety,coalesce((select sum(reservation.quantity)
        from inventory.reservation reservation where reservation.stockitem_id=locked.id and reservation.state='reserved'
          and reservation.expires_at>clock_timestamp()),0)::float8 reserved from locked order by array_position($1::text[],locked.id)`,
      [ids, scope]
    );
    const stocks = new Map(locked.rows.map((row) => [row.id, row]));
    for (const line of lines) {
      const stock = line.stockitem === null ? undefined : stocks.get(line.stockitem);
      if (!stock || available(stock.onhand, stock.reserved, stock.safety) < line.quantity) throw new DomainError('INVENTORY_INSUFFICIENT');
      const reservation = new Reservation(`reservation:${randomUUID()}`, line.quantity);
      await database.query(
        `insert into inventory.reservation(id,stockitem_id,owner_type,owner_id,quantity,state,expires_at,created_at,version)
        values($1,$2,'order',$3,$4,$5,clock_timestamp()+interval '30 minutes',clock_timestamp(),0)`,
        [reservation.id, stock.id, order, reservation.quantity, reservation.state]
      );
      await database.query(
        `insert into inventory.movement(id,stockitem_id,kind,quantity_delta,reference_type,reference_id,occurred_at)
        values($1,$2,'reserve',$3,'order',$4,clock_timestamp())`,
        [`movement:${randomUUID()}`, stock.id, -line.quantity, order]
      );
      stock.reserved += line.quantity;
    }
  }

  async commit(database: OperationDatabase, order: string): Promise<void> {
    const reservations = await database.query<{ id: string; stockitem_id: string; quantity: number }>(
      `select id,stockitem_id,quantity::float8 quantity
      from inventory.reservation where owner_type='order' and owner_id=$1 and state='reserved' order by stockitem_id for update`,
      [order]
    );
    for (const reservation of reservations.rows) {
      const stock = await database.query(
        `update inventory.stockitem set onhand=onhand-$2,version=version+1,updated_at=clock_timestamp()
        where id=$1 and onhand-safety>=$2 returning id`,
        [reservation.stockitem_id, reservation.quantity]
      );
      if (!stock.rows[0]) throw new Error('INVENTORY_COMMIT_CONFLICT');
      await database.query(`update inventory.reservation set state='committed',version=version+1 where id=$1`, [reservation.id]);
      await database.query(
        `insert into inventory.movement(id,stockitem_id,kind,quantity_delta,reference_type,reference_id,occurred_at)
        values($1,$2,'commit',$3,'order',$4,clock_timestamp())`,
        [`movement:${randomUUID()}`, reservation.stockitem_id, -reservation.quantity, order]
      );
    }
  }

  async release(database: OperationDatabase, order: string): Promise<void> {
    const reservations = await database.query<{ stockitem_id: string; quantity: number }>(
      `update inventory.reservation
      set state='released',version=version+1 where owner_type='order' and owner_id=$1 and state='reserved'
      returning stockitem_id,quantity::float8 quantity`,
      [order]
    );
    for (const item of reservations.rows)
      await database.query(
        `insert into inventory.movement
      (id,stockitem_id,kind,quantity_delta,reference_type,reference_id,occurred_at)
      values($1,$2,'release',$3,'order',$4,clock_timestamp())`,
        [`movement:${randomUUID()}`, item.stockitem_id, item.quantity, order]
      );
  }

  async expireCheckout(database: OperationDatabase, checkout: string): Promise<void> {
    await database.query(
      `update inventory.reservation set state='expired',version=version+1
      where owner_type='checkout' and owner_id=$1 and state='reserved'`,
      [checkout]
    );
  }
}
