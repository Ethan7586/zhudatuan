import type { ReadTransactionContext, WriteTransactionContext } from '../../../../platform/database/TransactionContext';
import type { ApprovalSubjectKind } from '../../domain/value/ApprovalSubject';
import type { ApprovalStep } from '../../domain/model/ApprovalTemplate';
import type { ApprovalDecisionRecord, ApprovalInstanceRecord, ApprovalTaskRecord } from '../../public/ApprovalRecord';
export type { ApprovalDecisionRecord, ApprovalInstanceRecord, ApprovalTaskRecord } from '../../public/ApprovalRecord';

export interface ApprovalTemplateRecord {
  readonly id: string;
  readonly scopeId: string;
  readonly code: string;
  readonly name: string;
  readonly subjectKind: ApprovalSubjectKind;
  readonly state: 'draft' | 'enabled' | 'disabled';
  readonly activeVersion: number | null;
  readonly version: number;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface ApprovalTemplateVersionRecord {
  readonly id: string;
  readonly templateId: string;
  readonly number: number;
  readonly name: string;
  readonly subjectKind: ApprovalSubjectKind;
  readonly steps: readonly ApprovalStep[];
  readonly escalations: readonly Readonly<{ afterHours: number; action: 'notify' | 'reassign' | 'reject'; target?: string }>[];
  readonly createdBy: string;
  readonly createdAt: string;
}

export interface ApprovalDecisionSnapshot {
  readonly task: ApprovalTaskRecord;
  readonly instance: ApprovalInstanceRecord;
  readonly requesterPrincipal: string;
}

export interface ApprovalInstanceCommand {
  readonly id: string;
  readonly scopeId: string;
  readonly requesterId: string;
  readonly subjectKind: ApprovalSubjectKind;
  readonly subjectId: string;
  readonly subjectVersion: number;
  readonly subjectSnapshot: Readonly<Record<string, unknown>>;
  readonly action: string;
  readonly evidenceHash: string;
  readonly amountMinor: number | null;
  readonly currency: string | null;
  readonly constraints: Readonly<Record<string, unknown>>;
  readonly expiresAt: string | null;
}

export interface ApprovalProofRecord {
  readonly id: string;
  readonly instanceId: string;
  readonly scopeId: string;
  readonly checkerId: string;
  readonly subjectKind: ApprovalSubjectKind;
  readonly subjectId: string;
  readonly subjectVersion: number;
  readonly action: string;
  readonly evidenceHash: string;
  readonly amountMinor: number | null;
  readonly currency: string | null;
  readonly constraints: Readonly<Record<string, unknown>>;
  readonly issuedAt: string;
  readonly expiresAt: string;
}

export interface ApprovalTemplateCommand {
  readonly id: string;
  readonly scopeId: string;
  readonly code: string;
  readonly name: string;
  readonly subjectKind: ApprovalSubjectKind;
  readonly steps: readonly ApprovalStep[];
  readonly escalations: readonly Readonly<{ afterHours: number; action: 'notify' | 'reassign' | 'reject'; target?: string }>[];
  readonly actorId: string;
  readonly expectedVersion: number | null;
}

export interface ApprovalRepository {
  createTemplate(context: WriteTransactionContext, command: ApprovalTemplateCommand): Promise<Readonly<{ template: ApprovalTemplateRecord; active: ApprovalTemplateVersionRecord }> | null>;
  reviseTemplate(context: WriteTransactionContext, command: ApprovalTemplateCommand): Promise<Readonly<{ template: ApprovalTemplateRecord; active: ApprovalTemplateVersionRecord }> | null>;
  setTemplateState(
    context: WriteTransactionContext,
    command: Readonly<{ id: string; scopeId: string; state: 'enabled' | 'disabled'; actorId: string; expectedVersion: number }>
  ): Promise<Readonly<{ template: ApprovalTemplateRecord; active: ApprovalTemplateVersionRecord }> | 'subjectconflict' | null>;
  getTemplate(context: ReadTransactionContext, scopeId: string, id: string): Promise<Readonly<{ template: ApprovalTemplateRecord; versions: readonly ApprovalTemplateVersionRecord[] }> | null>;
  listTemplates(context: ReadTransactionContext, query: Readonly<{ scopeId: string; state: string | null; subjectKind: string | null; sort: string | null; id: string | null; fetch: number }>): Promise<readonly ApprovalTemplateRecord[]>;
  listTasks(
    context: ReadTransactionContext,
    query: Readonly<{
      scopeId: string;
      membership: string;
      permissions: readonly string[];
      roles: readonly string[];
      state: string | null;
      subjectKind: string | null;
      sort: string | null;
      id: string | null;
      fetch: number;
    }>
  ): Promise<readonly ApprovalTaskRecord[]>;
  createInstance(context: WriteTransactionContext, command: ApprovalInstanceCommand): Promise<Readonly<{ instance: ApprovalInstanceRecord; assigned: readonly ApprovalTaskRecord[] }> | null>;
  cancelInstance(context: WriteTransactionContext, command: Readonly<{ scopeId: string; id: string; requesterId: string; expectedVersion: number; reason: string }>): Promise<Readonly<{ id: string; version: number }> | null>;
  consumeProof(
    context: WriteTransactionContext,
    command: Readonly<{
      tokenHash: Buffer;
      scopeId: string;
      subjectKind: ApprovalSubjectKind;
      subjectId: string;
      subjectVersion: number;
      action: string;
      evidenceHash: string;
      amountMinor: number | null;
      currency: string | null;
      constraints: Readonly<Record<string, unknown>>;
      consumerOperation: string;
      requestHash: string;
      consumerId: string;
    }>
  ): Promise<ApprovalProofRecord | null>;
  dueTasks(context: ReadTransactionContext, limit: number): Promise<readonly Readonly<{ task: ApprovalTaskRecord; instance: ApprovalInstanceRecord; escalation: Readonly<{ action: 'notify' | 'reassign' | 'reject'; target?: string }> }>[]>;
  escalateTask(
    context: WriteTransactionContext,
    command: Readonly<{ taskId: string; instanceId: string; action: 'notify' | 'reassign' | 'reject'; target?: string; expectedVersion: number; actorId: string }>
  ): Promise<Readonly<{ task: ApprovalTaskRecord; instance: ApprovalInstanceRecord }> | null>;
  getInstance(context: ReadTransactionContext, scopeId: string, id: string): Promise<ApprovalInstanceRecord | null>;
  lockTask(context: WriteTransactionContext, scopeId: string, id: string): Promise<ApprovalDecisionSnapshot | null>;
  decideTask(
    context: WriteTransactionContext,
    command: Readonly<{
      id: string;
      scopeId: string;
      membership: string;
      outcome: 'approved' | 'rejected';
      reason: string;
      evidence: Readonly<Record<string, unknown>>;
      decisionId: string;
      proofHash: Buffer | null;
      proofToken: string | null;
      proofId: string | null;
      proofExpiresAt: string | null;
      taskState: ApprovalTaskRecord['state'];
      instanceVersion: number;
      expectedVersion: number;
      nextState: ApprovalInstanceRecord['state'];
      nextStep: number | null;
    }>
  ): Promise<Readonly<{ task: ApprovalTaskRecord; instance: ApprovalInstanceRecord; decision: ApprovalDecisionRecord }> | null>;
}
