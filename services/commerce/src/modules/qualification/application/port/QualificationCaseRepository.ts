import type { ReadTransactionContext, WriteTransactionContext } from '../../../../foundation/persistence/TransactionContext';
import type { QualificationCaseSnapshot } from '../../domain/model/QualificationCase';
import type { QualificationTargetKind } from '../../domain/model/QualificationCase';

export interface QualificationCaseRecord extends Record<string, unknown> {
  readonly id: string;
  readonly title: string;
  readonly subject_kind: QualificationTargetKind;
  readonly subject_id: string;
  readonly state: 'draft' | 'verified' | 'published' | 'revoked' | 'expired';
  readonly version: number;
  readonly effective_at: string;
  readonly expires_at: string;
  readonly reviewed_at: string | null;
  readonly published_at: string | null;
  readonly revoked_at: string | null;
  readonly revoke_reason: string | null;
  readonly evidence_count: number;
  readonly applicability: readonly Readonly<{ kind: QualificationTargetKind; id: string }>[];
}

export interface QualificationCaseRepository {
  cases(context: ReadTransactionContext, scope: string, limit: number): Promise<readonly QualificationCaseRecord[]>;
  find(context: ReadTransactionContext, scope: string, id: string): Promise<QualificationCaseSnapshot | null>;
  lock(context: WriteTransactionContext, scope: string, id: string): Promise<QualificationCaseSnapshot | null>;
  save(context: WriteTransactionContext, value: QualificationCaseSnapshot, expectedVersion: number): Promise<QualificationCaseRecord | null>;
}
