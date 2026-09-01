import type { WriteTransactionContext } from '../../../../foundation/persistence/TransactionContext';

export interface OrderExpiryRepository {
  schedulePaymentQuery(context: WriteTransactionContext, intent: string, scope: string): Promise<void>;
  recordCancellation(context: WriteTransactionContext, order: string, scope: string, trace: string): Promise<void>;
}
