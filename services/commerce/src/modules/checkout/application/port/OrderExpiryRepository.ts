import type { WriteTransactionContext } from '../../../../foundation/persistence/TransactionContext';

export interface OrderExpiryRepository {
  claim(context: WriteTransactionContext, id: string, scope: string): Promise<boolean>;
  schedulePaymentQuery(context: WriteTransactionContext, intent: string, scope: string): Promise<void>;
  recordCancellation(context: WriteTransactionContext, order: string, scope: string, trace: string): Promise<void>;
}
