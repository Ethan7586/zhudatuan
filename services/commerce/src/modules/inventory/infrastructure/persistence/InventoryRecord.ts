import { createHash, randomUUID } from 'node:crypto';
import type { WriteTransactionContext } from '../../../../foundation/persistence/TransactionContext';
import { Reservation, type ReservationSnapshot } from '../../domain/model/Reservation';
import { StockItem, type StockItemSnapshot, type StockItemState } from '../../domain/model/StockItem';
import type { ReservationDemand } from '../../domain/policy/ReservationPolicy';

export interface StockRow extends Record<string, unknown> {
  readonly id: string;
  readonly scope_id: string;
  readonly sku_id: string;
  readonly location_id: string;
  readonly onhand: number;
  readonly safety: number;
  reserved: number;
  readonly version: number;
  readonly status: StockItemState;
  readonly updated_at: Date | string;
}

export interface ReservationRow extends Record<string, unknown> {
  readonly id: string;
  readonly stockitem_id: string;
  readonly owner_type: ReservationSnapshot['ownerKind'];
  readonly owner_id: string;
  readonly quantity: number;
  readonly state: ReservationSnapshot['state'];
  readonly expires_at: Date | string;
  readonly created_at: Date | string;
  readonly version: number;
}

export interface TransitionRow extends ReservationRow {
  readonly stock_id: string;
  readonly scope_id: string;
  readonly sku_id: string;
  readonly location_id: string;
  readonly onhand: number;
  readonly safety: number;
  readonly stock_version: number;
  readonly status: StockItemState;
  readonly updated_at: Date | string;
}

export function restoreStock(row: StockRow): StockItem {
  return StockItem.restore({ id: row.id, scope: row.scope_id, sku: row.sku_id, location: row.location_id, onhand: Number(row.onhand),
    safety: Number(row.safety), state: row.status, version: Number(row.version), updatedAt: inventoryTime(row.updated_at) });
}

export function restoreReservation(row: ReservationRow): Reservation {
  return Reservation.restore({ id: row.id, stockitem: row.stockitem_id, ownerKind: row.owner_type, owner: row.owner_id,
    quantity: Number(row.quantity), state: row.state, expiresAt: inventoryTime(row.expires_at), createdAt: inventoryTime(row.created_at), version: Number(row.version) });
}

export function stockEvent(context: WriteTransactionContext, stock: StockItemSnapshot, reserved: number) {
  return { id: `event:${randomUUID()}`, type: 'inventory.stock.changed', aggregateType: 'stockitem', aggregate: stock.id, scope: stock.scope,
    trace: context.trace, payload: { stockitem: stock.id, sku: stock.sku, available: Math.max(0, stock.onhand - stock.safety - reserved), reserved, version: stock.version } } as const;
}

export function eventLines(demands: readonly ReservationDemand[]) {
  return demands.map(({ sku, stockitem, quantity }) => ({ sku, stockitem, quantity }));
}

export function inventoryDigest(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}

export function inventoryTime(value: Date | string): string {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) throw new Error('INVENTORY_TIME_INVALID');
  return date.toISOString();
}
