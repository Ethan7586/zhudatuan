import type { ReadTransactionContext } from '../../../../foundation/persistence/TransactionContext';
import type { OrderSummaryRepository } from '../port/OrderSummaryRepository';

export interface OrderSummary {
  readonly id: string;
  readonly scope: string;
  readonly member: string;
  readonly number: string;
  readonly state: string;
  readonly totalMinor: number;
}

/** Public synchronous query used by modules that validate an order reference. */
export class GetOrderSummary {
  constructor(private readonly repository: OrderSummaryRepository) {}

  execute(context: ReadTransactionContext, order: string, scopes: readonly string[], member: string, memberOnly: boolean): Promise<OrderSummary | null> {
    return this.repository.find(context, order, scopes, member, memberOnly);
  }
}
