import type { ReadTransactionContext, WriteTransactionContext } from '../../../../foundation/persistence/TransactionContext';

export interface PendingEvidence {
  readonly objectReference: string;
  readonly sha256: string;
  readonly size: number;
  readonly contentType: string;
}

export interface SupportJobRepository {
  evidence(context: ReadTransactionContext, id: string): Promise<PendingEvidence | undefined>;
  completeEvidence(context: WriteTransactionContext, id: string, clean: boolean): Promise<void>;
  escalate(context: WriteTransactionContext, ticket: string, reason: 'response' | 'resolution'): Promise<void>;
}
