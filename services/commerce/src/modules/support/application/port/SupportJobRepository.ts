import type { ReadTransactionContext, WriteTransactionContext } from '../../../../platform/database/TransactionContext';
import type { AttachmentScanResult } from './AttachmentScanPort';

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
  completeEvidence(context: WriteTransactionContext, evidence: PendingEvidence, result: AttachmentScanResult): Promise<void>;
  escalate(context: WriteTransactionContext, ticket: string, reason: 'response' | 'resolution'): Promise<void>;
  reassign(context: WriteTransactionContext, agent: string, cursor: string | null): Promise<void>;
}
