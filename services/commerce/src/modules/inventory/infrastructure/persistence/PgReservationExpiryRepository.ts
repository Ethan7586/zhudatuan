import { createHash, randomUUID } from 'node:crypto';
import { PgRuntimeWriter } from '../../../../adapter/database/PgRuntimeWriter';
import { PgTransactionAccess } from '../../../../adapter/database/PgTransactionAccess';
import { DomainError } from '../../../../foundation/domain/DomainError';
import type { WriteTransactionContext } from '../../../../foundation/persistence/TransactionContext';
import type { ReservationExpiryRepository } from '../../application/port/ReservationExpiryRepository';
import { Reservation, type ReservationSnapshot } from '../../domain/model/Reservation';
import { StockItem, type StockItemSnapshot, type StockItemState } from '../../domain/model/StockItem';

interface ExpiryRow extends Record<string, unknown> {
  readonly id: string;
  readonly stockitem_id: string;
  readonly owner_type: ReservationSnapshot['ownerKind'];
  readonly owner_id: string;
  readonly quantity: number;
  readonly state: ReservationSnapshot['state'];
  readonly expires_at: Date | string;
  readonly created_at: Date | string;
  readonly version: number;
  readonly scope_id: string;
  readonly sku_id: string;
  readonly location_id: string;
  readonly onhand: number;
  readonly safety: number;
  readonly stock_version: number;
  readonly stock_status: StockItemState;
  readonly updated_at: Date | string;
}

export class PgReservationExpiryRepository implements ReservationExpiryRepository {
  constructor(private readonly transactions = new PgTransactionAccess()) {}

  async expire(context: WriteTransactionContext, owner: string | null, at: Date, limit: number): Promise<Readonly<{ expired: number; more: boolean }>> {
    const database = this.transactions.database(context);
    const result = await database.query<ExpiryRow>(
      `select reservation.id,reservation.stockitem_id,reservation.owner_type,reservation.owner_id,reservation.quantity::float8 quantity,
       reservation.state,reservation.expires_at,reservation.created_at,reservation.version::integer,stock.scope_id,stock.sku_id,
       stock.location_id,stock.onhand::float8 onhand,stock.safety::float8 safety,stock.version::integer stock_version,
       stock.status stock_status,stock.updated_at from inventory.reservation reservation join inventory.stockitem stock on stock.id=reservation.stockitem_id
       where reservation.state='reserved' and reservation.expires_at<=$1 and ($2::text is null or reservation.owner_id=$2)
       order by stock.id,reservation.id limit $3 for update of stock,reservation skip locked`, [at.toISOString(), owner, limit + 1]
    );
    const rows = result.rows.slice(0, limit);
    if (rows.length === 0) return Object.freeze({ expired: 0, more: false });
    const reservations = rows.map((row) => Reservation.restore({ id: row.id, stockitem: row.stockitem_id, ownerKind: row.owner_type,
      owner: row.owner_id, quantity: Number(row.quantity), state: row.state, expiresAt: iso(row.expires_at), createdAt: iso(row.created_at),
      version: Number(row.version) }).expire(at).snapshot());
    const stocks = new Map<string, StockItemSnapshot>();
    for (const row of rows) {
      if (stocks.has(row.stockitem_id)) continue;
      const stock = StockItem.restore({ id: row.stockitem_id, scope: row.scope_id, sku: row.sku_id, location: row.location_id,
        onhand: Number(row.onhand), safety: Number(row.safety), state: row.stock_status, version: Number(row.stock_version), updatedAt: iso(row.updated_at) });
      stocks.set(row.stockitem_id, stock.release(at.toISOString()).snapshot());
    }
    const reservationWrite = await database.query(
      `update inventory.reservation target set state='expired',version=input.version from jsonb_to_recordset($1::jsonb)
       input(id text,expected bigint,version bigint) where target.id=input.id and target.version=input.expected returning target.id`,
      [JSON.stringify(reservations.map(({ id, version }) => ({ id, expected: version - 1, version })))]
    );
    if (reservationWrite.rows.length !== reservations.length) throw new DomainError('VERSION_CONFLICT');
    const stockWrite = await database.query(
      `update inventory.stockitem target set version=input.version,updated_at=input."updatedAt" from jsonb_to_recordset($1::jsonb)
       input(id text,expected bigint,version bigint,"updatedAt" timestamptz) where target.id=input.id and target.version=input.expected returning target.id`,
      [JSON.stringify([...stocks.values()].map(({ id, version, updatedAt }) => ({ id, expected: version - 1, version, updatedAt })))]
    );
    if (stockWrite.rows.length !== stocks.size) throw new DomainError('VERSION_CONFLICT');
    await database.query(
      `insert into inventory.movement(id,stockitem_id,kind,quantity_delta,reference_type,reference_id,occurred_at)
       select input.id,input.stockitem,'release',input.quantity,input."ownerKind",input.owner,$2 from jsonb_to_recordset($1::jsonb)
       input(id text,stockitem text,quantity bigint,"ownerKind" text,owner text) on conflict(stockitem_id,kind,reference_type,reference_id) do nothing`,
      [JSON.stringify(reservations.map((item) => ({ id: `movement:${digest(`${item.id}:expired`)}`, stockitem: item.stockitem,
        quantity: item.quantity, ownerKind: item.ownerKind, owner: item.owner }))), at.toISOString()]
    );
    const balances = await database.query<{ id: string; reserved: number }>(
      `select stock.id,coalesce(sum(reservation.quantity) filter(where reservation.state='reserved' and reservation.expires_at>$2),0)::float8 reserved
       from inventory.stockitem stock left join inventory.reservation reservation on reservation.stockitem_id=stock.id
       where stock.id=any($1::text[]) group by stock.id`, [[...stocks.keys()], at.toISOString()]
    );
    const reserved = new Map(balances.rows.map((row) => [row.id, Number(row.reserved)]));
    const runtime = new PgRuntimeWriter(database);
    const owners = new Map<string, ReservationSnapshot[]>();
    for (const reservation of reservations) owners.set(`${reservation.ownerKind}:${reservation.owner}`, [...(owners.get(`${reservation.ownerKind}:${reservation.owner}`) ?? []), reservation]);
    await runtime.appendMany([
      ...[...owners.values()].map((items) => ({ id: `event:${randomUUID()}`, type: 'inventory.reservation.expired', aggregateType: items[0]!.ownerKind,
        aggregate: items[0]!.owner, scope: rows.find(({ owner_id }) => owner_id === items[0]!.owner)!.scope_id, trace: context.trace,
        payload: { owner: items[0]!.owner, ownerKind: items[0]!.ownerKind, lines: items.map((item) => ({
          sku: rows.find(({ id }) => id === item.id)!.sku_id, stockitem: item.stockitem, quantity: item.quantity })) } })),
      ...[...stocks.values()].map((stock) => ({ id: `event:${randomUUID()}`, type: 'inventory.stock.changed', aggregateType: 'stockitem',
        aggregate: stock.id, scope: stock.scope, trace: context.trace, payload: { stockitem: stock.id, sku: stock.sku,
          available: Math.max(0, stock.onhand - stock.safety - (reserved.get(stock.id) ?? 0)), reserved: reserved.get(stock.id) ?? 0, version: stock.version } })),
    ]);
    return Object.freeze({ expired: reservations.length, more: result.rows.length > limit });
  }
}

function iso(value: Date | string): string {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) throw new Error('INVENTORY_TIME_INVALID');
  return date.toISOString();
}
function digest(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}
