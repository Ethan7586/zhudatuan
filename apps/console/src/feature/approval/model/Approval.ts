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

export interface ApprovalInstance {
  readonly id: string;
  readonly templateId: string;
  readonly templateVersion: number;
  readonly subjectKind: ApprovalSubjectKind;
  readonly subjectId: string;
  readonly action: string;
  readonly amountMinor: number | null;
  readonly currency: string | null;
  readonly requesterId: string;
  readonly state: ApprovalInstanceDto['state'];
  readonly currentStep: number;
  readonly stepCount: number;
  readonly version: number;
  readonly createdAt: string;
  readonly expiresAt: string | null;
  readonly tasks: readonly ApprovalTask[];
  readonly decisions: readonly ApprovalDecision[];
}

export interface ApprovalTemplatePage {
  readonly kind: 'templates';
  readonly items: readonly ApprovalTemplate[];
  readonly count: number;
  readonly nextCursor?: string;
}

export interface ApprovalTaskPage {
  readonly kind: 'tasks';
  readonly items: readonly ApprovalTask[];
  readonly count: number;
  readonly nextCursor?: string;
}

export interface ApprovalTemplateDetail {
  readonly kind: 'template';
  readonly template: ApprovalTemplate;
  readonly versions: readonly ApprovalTemplateVersion[];
}

export type ApprovalResource = ApprovalTemplatePage | ApprovalTaskPage | ApprovalTemplateDetail;

export interface ApprovalTemplateDraft {
  readonly code: string;
  readonly name: string;
  readonly subjectKind: ApprovalSubjectKind;
  readonly steps: readonly ApprovalStep[];
  readonly escalations: readonly ApprovalEscalation[];
}

export type ApprovalCommand =
  | Readonly<{ kind: 'create'; draft: ApprovalTemplateDraft }>
  | Readonly<{ kind: 'revise'; template: ApprovalTemplate; draft: ApprovalTemplateDraft }>
  | Readonly<{ kind: 'enable'; template: ApprovalTemplate; reason: string }>
  | Readonly<{ kind: 'disable'; template: ApprovalTemplate; reason: string }>
  | Readonly<{ kind: 'approve'; task: ApprovalTask; reason: string }>
  | Readonly<{ kind: 'reject'; task: ApprovalTask; reason: string }>;
export type ApprovalTaskCommand = Extract<ApprovalCommand, { kind: 'approve' }> | Extract<ApprovalCommand, { kind: 'reject' }>;

export type ApprovalEditor =
  | Readonly<{ command: 'create'; draft: ApprovalTemplateDraft }>
  | Readonly<{ command: 'revise'; template: ApprovalTemplate; draft: ApprovalTemplateDraft }>
  | Readonly<{ command: 'enable'; template: ApprovalTemplate; reason: string }>
  | Readonly<{ command: 'disable'; template: ApprovalTemplate; reason: string }>
  | Readonly<{ command: 'approve'; task: ApprovalTask; reason: string }>
  | Readonly<{ command: 'reject'; task: ApprovalTask; reason: string }>;

export interface ApprovalReceipt {
  readonly id: string;
  readonly state: string;
  readonly version: number;
  readonly instanceId?: string;
  readonly subjectKind?: ApprovalSubjectKind;
  readonly subjectId?: string;
  readonly subjectVersion?: number;
  /** Opaque, single-use proof retained for the owning workflow; never render or log it. */
  readonly proof?: string;
}
