import type { ReadTransactionContext } from '../../../../foundation/persistence/TransactionContext';
import type { OrderSummary } from '../service/GetOrderSummary';

export interface OrderSummaryRepository {
  find(context: ReadTransactionContext, order: string, scopes: readonly string[], member: string, memberOnly: boolean): Promise<OrderSummary | null>;
  recent(context: ReadTransactionContext, scopes: readonly string[], member: string, memberOnly: boolean, limit: number): Promise<readonly OrderSummary[]>;
}
