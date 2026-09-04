import type { WriteTransactionContext } from '../../../../foundation/persistence/TransactionContext';

export interface BudgetExpiryRepository {
  expire(context: WriteTransactionContext, order: string, at: Date): Promise<void>;
}
