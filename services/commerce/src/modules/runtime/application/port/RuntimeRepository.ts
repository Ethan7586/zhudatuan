import type { ReadTransactionContext } from '../../../../platform/database/TransactionContext';

export interface RuntimeQueueState {
  readonly queued: number;
  readonly running: number;
  readonly deadletters: number;
  readonly oldest_seconds: number;
}

export interface RuntimeRepository {
  queueState(context: ReadTransactionContext): Promise<RuntimeQueueState>;
}
