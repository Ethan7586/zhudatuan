import { APPROVAL_SUBJECT_KINDS, type OperationOutputFor } from '@shop/contract';

type ApprovalTemplateDto = OperationOutputFor<'approval.templates.list'>['items'][number];
type ApprovalVersionDto = OperationOutputFor<'approval.templates.get'>['versions'][number];
type ApprovalTaskDto = OperationOutputFor<'approval.tasks.list'>['items'][number];
type ApprovalInstanceDto = OperationOutputFor<'approval.instances.get'>;

export { APPROVAL_SUBJECT_KINDS };
export type ApprovalSubjectKind = (typeof APPROVAL_SUBJECT_KINDS)[number];
export type ApprovalTemplateState = ApprovalTemplateDto['state'];
export type ApprovalTaskState = ApprovalTaskDto['state'];

export interface ApprovalApprover {
  readonly kind: ApprovalVersionDto['steps'][number]['approvers'][number]['kind'];
  readonly value: string;
  readonly minimumApprovals: number;
}

export interface ApprovalStep {
  readonly sequence: number;
  readonly name: string;
  readonly approvers: readonly ApprovalApprover[];
  readonly dueHours: number;
}

export interface ApprovalEscalation {
  readonly afterHours: number;
  readonly action: ApprovalVersionDto['escalations'][number]['action'];
  readonly target?: string;
}

export interface ApprovalTemplate {
  readonly id: string;
  readonly code: string;
  readonly name: string;
  readonly subjectKind: ApprovalSubjectKind;
  readonly state: ApprovalTemplateState;
  readonly activeVersion: number | null;
  readonly version: number;
  readonly updatedAt: string;
}

export interface ApprovalTemplateVersion {
  readonly id: string;
  readonly number: number;
  readonly name: string;
  readonly subjectKind: ApprovalSubjectKind;
  readonly steps: readonly ApprovalStep[];
  readonly escalations: readonly ApprovalEscalation[];
  readonly createdBy: string;
  readonly createdAt: string;
}

export interface ApprovalTask {
  readonly id: string;
  readonly instanceId: string;
  readonly sequence: number;
  readonly name: string;
  readonly assigneeKind: ApprovalApprover['kind'];
  readonly assignee: string;
  readonly state: ApprovalTaskState;
  readonly dueAt: string | null;
  readonly minimumApprovals: number;
  readonly approvalCount: number;
  readonly version: number;
}

export interface ApprovalDecision {
  readonly id: string;
  readonly taskId: string;
  readonly outcome: ApprovalInstanceDto['decisions'][number]['outcome'];
  readonly reason: string;
  readonly actorId: string;
  readonly decidedAt: string;
}
