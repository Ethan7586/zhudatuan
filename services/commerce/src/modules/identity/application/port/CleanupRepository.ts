import type { ReadTransactionContext, WriteTransactionContext } from '../../../../platform/database/TransactionContext';

export interface CleanupCursor {
  readonly state: string;
  readonly expires: Date;
  readonly id: string;
}

export interface InvitationCleanupRepository {
  expireInvitations(context: WriteTransactionContext, cursor: CleanupCursor | undefined, batch: number, trace: string): Promise<readonly CleanupCursor[]>;
  expireClaims(context: WriteTransactionContext, cursor: CleanupCursor | undefined, batch: number): Promise<readonly CleanupCursor[]>;
  expirePreauth(context: WriteTransactionContext, cursor: CleanupCursor | undefined, batch: number): Promise<readonly CleanupCursor[]>;
  expireRates(context: WriteTransactionContext, buckets: readonly string[], batch: number): Promise<number>;
  activeClaims(context: ReadTransactionContext): Promise<number>;
}

export interface FederationCleanupRepository {
  expire(context: WriteTransactionContext): Promise<void>;
}
