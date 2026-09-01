import type { WriteTransactionContext } from '../../../../foundation/persistence/TransactionContext';

export interface CleanupRepository {
  prepare(context: WriteTransactionContext, currentJobId: string): Promise<void>;
  complete(context: WriteTransactionContext): Promise<void>;
}
