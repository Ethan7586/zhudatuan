import { randomUUID } from 'node:crypto';
import { PgRuntimeWriter } from '../../../../adapter/database/PgRuntimeWriter';
import { PgTransactionAccess } from '../../../../adapter/database/PgTransactionAccess';
import type { Clock } from '../../../../foundation/domain/Clock';
import { SystemClock } from '../../../../foundation/domain/Clock';
import { DomainError } from '../../../../foundation/domain/DomainError';
import type { WriteTransactionContext } from '../../../../foundation/persistence/TransactionContext';
import { Reservation, type ReservationSnapshot } from '../../domain/model/Reservation';
import { StockItem, type StockItemSnapshot } from '../../domain/model/StockItem';
import { ReservationPolicy } from '../../domain/policy/ReservationPolicy';
import type { StockDemand } from '../../public/StockDemand';
import { appendMovements } from './InventoryLedger';
import { eventLines, inventoryDigest, inventoryTime, restoreReservation, restoreStock, stockEvent,
  type ReservationRow, type StockRow, type TransitionRow } from './InventoryRecord';

export class PgReservationRepository {
  constructor(
    private readonly transactions = new PgTransactionAccess(),
    private readonly clock: Clock = SystemClock,
    private readonly policy = new ReservationPolicy()
  ) {}

  async reserve(context: WriteTransactionContext, order: string, scope: string, values: readonly StockDemand[]): Promise<void> {
    const database = this.transactions.database(context);
    const demands = this.policy.demands(values);
    if (demands.length === 0) return;
    const ids = demands.map(({ stockitem }) => stockitem);
    const locked = await database.query<StockRow>(
      `with locked as(select stock.id,stock.scope_id,stock.sku_id,stock.location_id,stock.onhand,stock.safety,stock.version,stock.status,stock.updated_at
       from inventory.stockitem stock where stock.id=any($1::text[]) and stock.scope_id=$2 and stock.status='active'
       order by stock.id for update) select locked.id,locked.scope_id,locked.sku_id,locked.location_id,locked.onhand,
       locked.safety,locked.version,locked.status,locked.updated_at,coalesce((select sum(reservation.quantity) from inventory.reservation reservation
       where reservation.stockitem_id=locked.id and reservation.state='reserved' and reservation.expires_at>clock_timestamp()),0)::float8 reserved
       from locked order by locked.id`, [ids, scope]
    );
    if (locked.rows.length !== demands.length) throw new DomainError('INVENTORY_INSUFFICIENT');
    const existing = await database.query<ReservationRow>(
      `select id,stockitem_id,owner_type,owner_id,quantity::float8 quantity,state,expires_at,created_at,version::integer
       from inventory.reservation where owner_type='order' and owner_id=$1 and stockitem_id=any($2::text[]) order by stockitem_id for update`, [order, ids]
    );
    const prior = new Map(existing.rows.map((row) => [row.stockitem_id, restoreReservation(row)]));
    const stocks = new Map(locked.rows.map((row) => [row.id, row]));
    const now = this.clock.now();
    const expiresAt = new Date(now.getTime() + 30 * 60_000).toISOString();
    const created: ReservationSnapshot[] = [];
    const updates: Array<Readonly<{ id: string; expected: number; version: number; updatedAt: string }>> = [];
    for (const demand of demands) {
      const found = prior.get(demand.stockitem);
      if (found) {
        const snapshot = found.snapshot();
        if (snapshot.quantity !== demand.quantity || !['reserved', 'committed'].includes(snapshot.state)) throw new DomainError('INVENTORY_RESERVATION_FINAL');
        continue;
      }
      const row = stocks.get(demand.stockitem)!;
      const stock = restoreStock(row);
      const next = this.policy.reserve(stock, row.reserved, demand.quantity, now.toISOString()).snapshot();
      created.push(Reservation.reserve({ id: `reservation:${randomUUID()}`, stockitem: demand.stockitem, ownerKind: 'order', owner: order,
        quantity: demand.quantity, expiresAt, createdAt: now.toISOString() }).snapshot());
      updates.push(Object.freeze({ id: next.id, expected: stock.snapshot().version, version: next.version, updatedAt: next.updatedAt }));
      row.reserved += demand.quantity;
    }
    if (created.length === 0) return;
    const touched = await database.query(`update inventory.stockitem target set version=input.version,updated_at=input."updatedAt"
      from jsonb_to_recordset($1::jsonb) input(id text,expected bigint,version bigint,"updatedAt" timestamptz)
      where target.id=input.id and target.version=input.expected returning target.id`, [JSON.stringify(updates)]);
    if (touched.rows.length !== updates.length) throw new DomainError('VERSION_CONFLICT');
    await database.query(`insert into inventory.reservation(id,stockitem_id,owner_type,owner_id,quantity,state,expires_at,created_at,version)
      select input.id,input.stockitem,'order',$2,input.quantity,input.state,input."expiresAt",input."createdAt",input.version
      from jsonb_to_recordset($1::jsonb) input(id text,stockitem text,quantity bigint,state text,"expiresAt" timestamptz,"createdAt" timestamptz,version bigint)`,
    [JSON.stringify(created.map(({ id, stockitem, quantity, state, expiresAt: expiry, createdAt, version }) => ({ id, stockitem, quantity, state, expiresAt: expiry, createdAt, version }))), order]);
    await appendMovements(database, created.map((item) => ({ id: `movement:${item.id.slice('reservation:'.length)}`, stockitem: item.stockitem,
      kind: 'reserve', quantity: -item.quantity, referenceKind: 'order', reference: order })));
    const runtime = new PgRuntimeWriter(database);
    await runtime.schedule({ id: `job:reservationexpiry:${order.slice('order:'.length)}`, kind: 'reservationexpiry', owner: 'inventory', scope,
      payload: { owner: order }, priority: 100, availableAt: expiresAt });
    await runtime.appendMany([
      { id: `event:${randomUUID()}`, type: 'inventory.reservation.created', aggregateType: 'order', aggregate: order, scope,
        trace: context.trace, payload: { owner: order, ownerKind: 'order', lines: eventLines(demands) } },
      ...updates.map(({ id, version }) => {
        const row = stocks.get(id)!;
        return stockEvent(context, { ...restoreStock(row).snapshot(), version, updatedAt: now.toISOString() }, row.reserved);
      }),
    ]);
  }

  commit(context: WriteTransactionContext, order: string): Promise<void> {
    return this.transition(context, 'order', order, 'committed');
  }
  release(context: WriteTransactionContext, order: string): Promise<void> {
    return this.transition(context, 'order', order, 'released');
  }
  expireCheckout(context: WriteTransactionContext, checkout: string): Promise<void> {
    return this.transition(context, 'checkout', checkout, 'expired');
  }

  private async transition(context: WriteTransactionContext, ownerKind: ReservationSnapshot['ownerKind'], owner: string,
    state: Exclude<ReservationSnapshot['state'], 'reserved'>): Promise<void> {
    const database = this.transactions.database(context);
    const result = await database.query<TransitionRow>(
      `select reservation.id,reservation.stockitem_id,reservation.owner_type,reservation.owner_id,reservation.quantity::float8 quantity,
       reservation.state,reservation.expires_at,reservation.created_at,reservation.version::integer,stock.id stock_id,stock.scope_id,
       stock.sku_id,stock.location_id,stock.onhand::float8 onhand,stock.safety::float8 safety,stock.version::integer stock_version,
       stock.status,stock.updated_at from inventory.reservation reservation join inventory.stockitem stock on stock.id=reservation.stockitem_id
       where reservation.owner_type=$1 and reservation.owner_id=$2 order by stock.id for update of stock,reservation`, [ownerKind, owner]
    );
    if (result.rows.length === 0) return;
    const now = this.clock.now();
    const reservations: ReservationSnapshot[] = [];
    const stocks: StockItemSnapshot[] = [];
    for (const row of result.rows) {
      const current = restoreReservation(row);
      const next = state === 'committed' ? current.commit(now) : state === 'released' ? current.release() : current.expire(now);
      if (next === current) continue;
      const stock = StockItem.restore({ id: row.stock_id, scope: row.scope_id, sku: row.sku_id, location: row.location_id,
        onhand: Number(row.onhand), safety: Number(row.safety), state: row.status, version: Number(row.stock_version), updatedAt: inventoryTime(row.updated_at) });
      reservations.push(next.snapshot());
      stocks.push((state === 'committed' ? stock.confirm(next.snapshot().quantity, now.toISOString()) : stock.release(now.toISOString())).snapshot());
    }
    if (reservations.length === 0) return;
    const reservationWrite = await database.query(`update inventory.reservation target set state=input.state,version=input.version
      from jsonb_to_recordset($1::jsonb) input(id text,state text,expected bigint,version bigint)
      where target.id=input.id and target.version=input.expected returning target.id`,
    [JSON.stringify(reservations.map((item) => ({ id: item.id, state: item.state, expected: item.version - 1, version: item.version })))]);
    if (reservationWrite.rows.length !== reservations.length) throw new DomainError('VERSION_CONFLICT');
    const stockWrite = await database.query(`update inventory.stockitem target set onhand=input.onhand,version=input.version,updated_at=input."updatedAt"
      from jsonb_to_recordset($1::jsonb) input(id text,onhand bigint,expected bigint,version bigint,"updatedAt" timestamptz)
      where target.id=input.id and target.version=input.expected returning target.id`,
    [JSON.stringify(stocks.map((item) => ({ id: item.id, onhand: item.onhand, expected: item.version - 1, version: item.version, updatedAt: item.updatedAt })))]);
    if (stockWrite.rows.length !== stocks.length) throw new DomainError('VERSION_CONFLICT');
    const movementKind = state === 'committed' ? 'commit' : 'release';
    await appendMovements(database, reservations.map((item) => ({ id: `movement:${inventoryDigest(`${item.id}:${state}`)}`, stockitem: item.stockitem,
      kind: movementKind, quantity: (state === 'committed' ? -1 : 1) * item.quantity, referenceKind: ownerKind, reference: owner })));
    const balances = await database.query<{ id: string; reserved: number }>(`select stock.id,coalesce(sum(reservation.quantity)
      filter(where reservation.state='reserved' and reservation.expires_at>clock_timestamp()),0)::float8 reserved from inventory.stockitem stock
      left join inventory.reservation reservation on reservation.stockitem_id=stock.id where stock.id=any($1::text[]) group by stock.id`, [stocks.map(({ id }) => id)]);
    const reserved = new Map(balances.rows.map((row) => [row.id, Number(row.reserved)]));
    await new PgRuntimeWriter(database).appendMany([
      { id: `event:${randomUUID()}`, type: `inventory.reservation.${state === 'committed' ? 'confirmed' : state}`, aggregateType: ownerKind,
        aggregate: owner, scope: result.rows[0]!.scope_id, trace: context.trace, payload: { owner, ownerKind, lines: reservations.map((item) => ({
          sku: result.rows.find(({ id }) => id === item.id)!.sku_id, stockitem: item.stockitem, quantity: item.quantity })) } },
      ...stocks.map((stock) => stockEvent(context, stock, reserved.get(stock.id) ?? 0)),
    ]);
  }
}
