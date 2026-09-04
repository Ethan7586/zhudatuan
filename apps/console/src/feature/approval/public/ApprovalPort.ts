import type { ConsoleContext } from '../../../entity/session/ConsoleSession';
import type { ApprovalCommand, ApprovalInstance, ApprovalReceipt, ApprovalResource, ApprovalSubjectKind, ApprovalTaskState, ApprovalTemplateState } from '../model/Approval';

export type ApprovalReadRequest =
  | Readonly<{ kind: 'templates'; cursor?: string; state?: ApprovalTemplateState; subjectKind?: ApprovalSubjectKind }>
  | Readonly<{ kind: 'tasks'; cursor?: string; state?: ApprovalTaskState; subjectKind?: ApprovalSubjectKind }>
  | Readonly<{ kind: 'template'; templateId: string }>;

export interface ApprovalPort {
  read(context: ConsoleContext, request: ApprovalReadRequest, signal?: AbortSignal): Promise<ApprovalResource>;
  readInstance(context: ConsoleContext, instanceId: string, signal?: AbortSignal): Promise<ApprovalInstance>;
  execute(context: ConsoleContext, command: ApprovalCommand, identity: string, signal?: AbortSignal): Promise<ApprovalReceipt>;
}
