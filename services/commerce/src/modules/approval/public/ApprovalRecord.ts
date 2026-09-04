import type { ApprovalSubjectKind } from './ApprovalSubject';

export interface ApprovalTaskRecord {
  readonly id: string;
  readonly instanceId: string;
  readonly sequence: number;
  readonly name: string;
  readonly assigneeKind: 'permission' | 'role' | 'membership';
  readonly assignee: string;
  readonly state: 'pending' | 'approved' | 'rejected' | 'cancelled' | 'expired' | 'escalated';
  readonly dueAt: string | null;
  readonly decidedBy: string | null;
  readonly decidedAt: string | null;
  readonly reason: string | null;
  readonly minimumApprovals: number;
  readonly approvalCount: number;
  readonly version: number;
}

export interface ApprovalDecisionRecord {
  readonly id: string;
  readonly instanceId: string;
  readonly taskId: string;
  readonly outcome: 'approved' | 'rejected';
  readonly reason: string;
  readonly actorId: string;
  readonly evidence: Readonly<Record<string, unknown>>;
  readonly proofId: string | null;
  readonly proof: string | null;
  readonly decidedAt: string;
}

export interface ApprovalInstanceRecord {
  readonly id: string;
  readonly scopeId: string;
  readonly templateId: string;
  readonly templateVersion: number;
  readonly subjectKind: ApprovalSubjectKind;
  readonly subjectId: string;
  readonly subjectVersion: number;
  readonly subjectSnapshot: Readonly<Record<string, unknown>>;
  readonly action: string;
  readonly evidenceHash: string;
  readonly amountMinor: number | null;
  readonly currency: string | null;
  readonly constraints: Readonly<Record<string, unknown>>;
  readonly requesterId: string;
  readonly state: 'pending' | 'approved' | 'rejected' | 'cancelled' | 'expired';
  readonly currentStep: number;
  readonly stepCount: number;
  readonly version: number;
  readonly createdAt: string;
  readonly decidedAt: string | null;
  readonly expiresAt: string | null;
  readonly tasks: readonly ApprovalTaskRecord[];
  readonly decisions: readonly ApprovalDecisionRecord[];
}
