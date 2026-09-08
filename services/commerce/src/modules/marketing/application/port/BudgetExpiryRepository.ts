import type { WriteTransactionContext } from '../../../../platform/database/TransactionContext';

export interface BudgetExpiryRepository {
  expire(context: WriteTransactionContext, order: string, at: Date): Promise<void>;
}
