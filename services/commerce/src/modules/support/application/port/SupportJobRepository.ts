import type { ReadTransactionContext, WriteTransactionContext } from '../../../../foundation/persistence/TransactionContext';

export interface PendingEvidence {
  readonly id: string;
  readonly objectReference: string;
  readonly sha256: string;
  readonly size: number;
  readonly contentType: string;
  readonly originalName: string;
  readonly uploadExpiresAt: string;
  readonly scope: string;
  readonly ticket: string;
  readonly conversation: string;
}

export interface SupportJobRepository {
  evidence(context: ReadTransactionContext, id: string): Promise<PendingEvidence | undefined>;
  completeEvidence(context: WriteTransactionContext, evidence: PendingEvidence, clean: boolean, reason: string | null): Promise<void>;
  escalate(context: WriteTransactionContext, ticket: string, reason: 'response' | 'resolution'): Promise<void>;
  reassign(context: WriteTransactionContext, agent: string, cursor: string | null): Promise<void>;
}
