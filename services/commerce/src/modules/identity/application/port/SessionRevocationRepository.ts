import type { WriteTransactionContext } from '../../../../foundation/persistence/TransactionContext';

export interface SessionRevocationRepository {
  revokeStale(context: WriteTransactionContext, input: Readonly<{ membership: string; version: number; reason: string; trace: string }>): Promise<readonly string[]>;
}
