import type { ReadTransactionContext } from '../../../../foundation/persistence/TransactionContext';

export interface RuntimeDatabaseState {
  readonly writable: boolean;
  readonly migration: boolean;
  readonly contract: boolean;
  readonly role: boolean;
  readonly operations: number;
  readonly events: number;
}

export interface RuntimeQueueState {
  readonly queued: number;
  readonly running: number;
  readonly deadletters: number;
  readonly oldest_seconds: number;
}

export interface RuntimeRepository {
  databaseState(context: ReadTransactionContext): Promise<RuntimeDatabaseState>;
  queueState(context: ReadTransactionContext): Promise<RuntimeQueueState>;
}
