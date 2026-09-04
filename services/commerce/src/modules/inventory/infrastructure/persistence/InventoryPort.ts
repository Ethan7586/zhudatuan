import { PgTransactionAccess } from '../../../../adapter/database/PgTransactionAccess';
import type { Clock } from '../../../../foundation/domain/Clock';
import { SystemClock } from '../../../../foundation/domain/Clock';
import type { ReadTransactionContext, WriteTransactionContext } from '../../../../foundation/persistence/TransactionContext';
import { ReservationPolicy } from '../../domain/policy/ReservationPolicy';
import type { StockDemand } from '../../public/StockDemand';
import { PgReservationRepository } from './PgReservationRepository';
import { PgStockRepository } from './PgStockRepository';

export class InventoryPort {
  private readonly stocks: PgStockRepository;
  private readonly reservations: PgReservationRepository;

  constructor(transactions = new PgTransactionAccess(), clock: Clock = SystemClock, policy = new ReservationPolicy()) {
    this.stocks = new PgStockRepository(transactions, clock);
    this.reservations = new PgReservationRepository(transactions, clock, policy);
  }

  availability(context: ReadTransactionContext, scope: string, skus: readonly string[]) {
    return this.stocks.availability(context, scope, skus);
  }

  stock(context: ReadTransactionContext, skus: readonly string[], scopes: readonly string[]): Promise<readonly Readonly<Record<string, unknown>>[]> {
    return this.stocks.stock(context, skus, scopes);
  }

  observe(context: WriteTransactionContext,
    input: Readonly<{ id: string; scope: string; sku: string; location: string; onhand: number; safety: number; provider: string; version: string }>): Promise<void> {
    return this.stocks.observe(context, input);
  }

  reserve(context: WriteTransactionContext, order: string, scope: string, demand: readonly StockDemand[]): Promise<void> {
    return this.reservations.reserve(context, order, scope, demand);
  }

  commit(context: WriteTransactionContext, order: string): Promise<void> {
    return this.reservations.commit(context, order);
  }

  release(context: WriteTransactionContext, order: string): Promise<void> {
    return this.reservations.release(context, order);
  }

  expireCheckout(context: WriteTransactionContext, checkout: string): Promise<void> {
    return this.reservations.expireCheckout(context, checkout);
  }
}
