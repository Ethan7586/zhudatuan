import { publicPort } from '../../../composition/ModuleRegistry';
import type { WriteTransactionContext } from '../../../platform/database/TransactionContext';
import type { ApprovalSubjectKind } from './ApprovalSubject';

export interface ApprovalRequest {
  readonly scopeId: string;
  readonly requesterId: string;
  readonly subject: Readonly<{
    kind: ApprovalSubjectKind;
    id: string;
    version: number;
    snapshot: Readonly<Record<string, unknown>>;
  }>;
  readonly action: string;
  readonly evidenceHash: string;
  /** Monetary approval ceiling. Both fields must be supplied together. */
  readonly amountMinor?: number;
  readonly currency?: string;
  readonly constraints: Readonly<Record<string, unknown>>;
  readonly expiresAt: string | null;
}

export interface ApprovalRequestReceipt {
  readonly instanceId: string;
  readonly state: 'pending';
  readonly templateId: string;
  readonly templateVersion: number;
  readonly version: number;
  readonly requestedAt: string;
}

export interface ApprovalProofBinding {
  readonly scopeId: string;
  readonly subjectKind: ApprovalSubjectKind;
  readonly subjectId: string;
  readonly subjectVersion: number;
  readonly action: string;
  readonly evidenceHash: string;
  readonly amountMinor: number | null;
  readonly currency: string | null;
  readonly constraints: Readonly<Record<string, unknown>>;
  readonly consumerOperation: string;
  readonly requestHash: string;
}

export interface ApprovedActionProof {
  readonly proofId: string;
  readonly instanceId: string;
  readonly checkerId: string;
  readonly binding: ApprovalProofBinding;
  readonly issuedAt: string;
  readonly expiresAt: string;
}

export interface ApprovalPort {
  request(context: WriteTransactionContext, request: ApprovalRequest): Promise<ApprovalRequestReceipt>;
  cancel(
    context: WriteTransactionContext,
    command: Readonly<{ scopeId: string; instanceId: string; requesterId: string; expectedVersion: number; reason: string }>
  ): Promise<Readonly<{ instanceId: string; state: 'cancelled'; version: number }>>;
  consume(context: WriteTransactionContext, proof: string, binding: ApprovalProofBinding): Promise<ApprovedActionProof>;
}

export const APPROVAL_PORT = publicPort<ApprovalPort>('approval', 'approval');
