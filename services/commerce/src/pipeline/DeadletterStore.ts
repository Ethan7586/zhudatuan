import type { WriteTransactionContext } from '../platform/database/TransactionContext';

export interface DeadletterRecord {
  readonly id: string;
  readonly kind: string;
  readonly source: string;
  readonly owner: string;
  readonly payload: unknown;
  readonly error: string;
  readonly attempts: number;
}

export interface DeadletterStore {
  record(context: WriteTransactionContext, record: DeadletterRecord): Promise<void>;
}
