import type { WriteTransactionContext } from '../../../../platform/database/TransactionContext';

export interface SessionRevocationRepository {
  revokeStale(context: WriteTransactionContext, input: Readonly<{ membership: string; version: number; reason: string; trace: string }>): Promise<readonly string[]>;
}
