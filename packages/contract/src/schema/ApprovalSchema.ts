import { array, int, literal, maxLength, minLength, null as nullSchema, optional, positive, strictObject, string, union } from 'zod/mini';
import { ContractJsonValueSchema } from './JsonSchema';
import { APPROVAL_SUBJECT_KINDS } from '../Vocabulary';
import { currency, expectedVersion, id, isoUtc, pageOutput, pageQuery, unsigned, version } from './Primitives';

const nullableTime = union([isoUtc, nullSchema()]);
const nullableText = union([string(), nullSchema()]);
const requiredText = string().check(minLength(2), maxLength(500));
const positiveInteger = int().check(positive());
const subjectKind = literal(APPROVAL_SUBJECT_KINDS);
const templateState = literal(['draft', 'enabled', 'disabled']);
const instanceState = literal(['pending', 'approved', 'rejected', 'cancelled', 'expired']);
const taskState = literal(['pending', 'approved', 'rejected', 'cancelled', 'expired', 'escalated']);
const approverPolicy = strictObject({ kind: literal(['permission', 'role', 'membership']), value: requiredText, minimumApprovals: positiveInteger });
const step = strictObject({ sequence: positiveInteger, name: requiredText, approvers: array(approverPolicy), dueHours: positiveInteger });
const escalation = strictObject({ afterHours: positiveInteger, action: literal(['notify', 'reassign', 'reject']), target: optional(requiredText) });
const templateVersion = strictObject({
  id: id<'approvaltemplateversion'>(),
  templateId: id<'approvaltemplate'>(),
  number: positiveInteger,
  name: requiredText,
  subjectKind,
  steps: array(step),
  escalations: array(escalation),
  createdBy: id<'membership'>(),
  createdAt: isoUtc,
});
const template = strictObject({
  id: id<'approvaltemplate'>(),
  scopeId: id<'scope'>(),
  code: string().check(minLength(3), maxLength(64)),
  name: requiredText,
  subjectKind,
  state: templateState,
  activeVersion: union([unsigned, nullSchema()]),
  version,
  createdAt: isoUtc,
  updatedAt: isoUtc,
});
const task = strictObject({
  id: id<'approvaltask'>(),
  instanceId: id<'approvalinstance'>(),
  sequence: positiveInteger,
  name: requiredText,
  assigneeKind: literal(['permission', 'role', 'membership']),
  assignee: string(),
  state: taskState,
  dueAt: nullableTime,
  decidedBy: union([id<'membership'>(), nullSchema()]),
  decidedAt: nullableTime,
  reason: nullableText,
  minimumApprovals: positiveInteger,
  approvalCount: unsigned,
  version,
});
const decision = strictObject({
  id: id<'approvaldecision'>(),
  instanceId: id<'approvalinstance'>(),
  taskId: id<'approvaltask'>(),
  outcome: literal(['approved', 'rejected']),
  reason: string(),
  actorId: id<'membership'>(),
  evidence: ContractJsonValueSchema,
  proofId: union([id<'approvalproof'>(), nullSchema()]),
  proof: nullableText,
  decidedAt: isoUtc,
});
const instance = strictObject({
  id: id<'approvalinstance'>(),
  scopeId: id<'scope'>(),
  templateId: id<'approvaltemplate'>(),
  templateVersion: positiveInteger,
  subjectKind,
  subjectId: string(),
  subjectVersion: unsigned,
  subjectSnapshot: ContractJsonValueSchema,
  action: string(),
  evidenceHash: string(),
  amountMinor: union([unsigned, nullSchema()]),
  currency: union([currency, nullSchema()]),
  constraints: ContractJsonValueSchema,
  requesterId: id<'membership'>(),
  state: instanceState,
  currentStep: positiveInteger,
  stepCount: positiveInteger,
  version,
  createdAt: isoUtc,
  decidedAt: nullableTime,
  expiresAt: nullableTime,
  tasks: array(task),
  decisions: array(decision),
});

const templateDraft = {
  code: string().check(minLength(3), maxLength(64)),
  name: requiredText,
  subjectKind,
  steps: array(step),
  escalations: optional(array(escalation)),
} as const;

export const APPROVAL_BODY_SCHEMAS = {
  ApprovalTemplatesCreateInput: strictObject(templateDraft),
  ApprovalTemplatesReviseInput: strictObject({ ...templateDraft, expectedVersion }),
  ApprovalTemplatesEnableInput: strictObject({ expectedVersion, reason: requiredText }),
  ApprovalTemplatesDisableInput: strictObject({ expectedVersion, reason: requiredText }),
  ApprovalTasksApproveInput: strictObject({ expectedVersion, reason: requiredText, evidence: optional(ContractJsonValueSchema) }),
  ApprovalTasksRejectInput: strictObject({ expectedVersion, reason: requiredText, evidence: optional(ContractJsonValueSchema) }),
} as const;

export const APPROVAL_QUERY_SCHEMAS = {
  ApprovalTemplatesGetInput: strictObject({}),
  ApprovalTemplatesListInput: strictObject({ ...pageQuery, state: optional(templateState), subjectKind: optional(subjectKind) }),
  ApprovalTasksListInput: strictObject({ ...pageQuery, state: optional(taskState), subjectKind: optional(subjectKind) }),
  ApprovalInstancesGetInput: strictObject({}),
} as const;

export const APPROVAL_OUTPUT_SCHEMAS = {
  ApprovalTemplatesCreateOutput: strictObject({ template, active: templateVersion }),
  ApprovalTemplatesReviseOutput: strictObject({ template, active: templateVersion }),
  ApprovalTemplatesEnableOutput: strictObject({ template, active: templateVersion }),
  ApprovalTemplatesDisableOutput: strictObject({ template, active: templateVersion }),
  ApprovalTemplatesGetOutput: strictObject({ template, versions: array(templateVersion) }),
  ApprovalTemplatesListOutput: pageOutput(template),
  ApprovalTasksListOutput: pageOutput(task),
  ApprovalTasksApproveOutput: strictObject({ task, instance, decision }),
  ApprovalTasksRejectOutput: strictObject({ task, instance, decision }),
  ApprovalInstancesGetOutput: instance,
} as const;
