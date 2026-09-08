import type { ApprovalApprover, ApprovalEditor, ApprovalEscalation, ApprovalStep, ApprovalSubjectKind, ApprovalTaskState, ApprovalTemplate, ApprovalTemplateDraft, ApprovalTemplateState } from '../model/Approval';

const blankApprover = (): ApprovalApprover => Object.freeze({ kind: 'permission', value: '', minimumApprovals: 1 });
const blankStep = (sequence: number): ApprovalStep => Object.freeze({ sequence, name: sequence === 1 ? '业务负责人审批' : `第 ${sequence} 步审批`, approvers: Object.freeze([blankApprover()]), dueHours: 24 });
const blankEscalation = (): ApprovalEscalation => Object.freeze({ afterHours: 24, action: 'notify' });

export const blankApprovalDraft = (subjectKind: ApprovalSubjectKind): ApprovalTemplateDraft => Object.freeze({ code: '', name: '', subjectKind, steps: Object.freeze([blankStep(1)]), escalations: Object.freeze([]) });

export function validateApprovalEditor(editor: ApprovalEditor | undefined, assurance: number): string | undefined {
  if (editor === undefined) return undefined;
  if (assurance < 3) return '此操作需要先完成二次验证。';
  if (editor.command === 'create' || editor.command === 'revise') {
    if (!/^[A-Za-z0-9][A-Za-z0-9.-]{2,63}$/.test(editor.draft.code.trim())) return '规则编码需为 3 至 64 位字母、数字、点或短横线。';
    if (editor.draft.name.trim().length < 2 || editor.draft.name.trim().length > 500) return '规则名称需为 2 至 500 个字符。';
    if (editor.draft.steps.length === 0) return '至少需要一个审批步骤。';
    for (const step of editor.draft.steps) {
      if (step.name.trim().length < 2 || step.name.trim().length > 500) return '审批步骤名称需为 2 至 500 个字符。';
      if (!Number.isSafeInteger(step.dueHours) || step.dueHours < 1) return '处理时限必须为正整数小时。';
      if (step.approvers.length === 0) return '每个步骤至少需要一个审批人条件。';
      for (const approver of step.approvers) {
        if (approver.value.trim().length < 2 || approver.value.trim().length > 500) return '审批人条件需为 2 至 500 个字符。';
        if (!Number.isSafeInteger(approver.minimumApprovals) || approver.minimumApprovals < 1) return '最少同意人数必须为正整数。';
      }
    }
    for (const escalation of editor.draft.escalations) {
      if (!Number.isSafeInteger(escalation.afterHours) || escalation.afterHours < 1) return '升级时限必须为正整数小时。';
      if (escalation.action === 'reassign' && (escalation.target?.trim().length ?? 0) < 2) return '重新指派时必须填写目标。';
    }
    return undefined;
  }
  return editor.reason.trim().length < 2 || editor.reason.trim().length > 500 ? '请填写 2 至 500 个字符的审计原因。' : undefined;
}

export function approvalDraftFor(template: ApprovalTemplate, version: Readonly<{ steps: readonly ApprovalStep[]; escalations: readonly ApprovalEscalation[] }>): ApprovalTemplateDraft {
  return Object.freeze({
    code: template.code,
    name: template.name,
    subjectKind: template.subjectKind,
    steps: Object.freeze(version.steps.map(copyStep)),
    escalations: Object.freeze(version.escalations.map((item) => Object.freeze({ ...item }))),
  });
}

export function approvalTemplateStatus(value: string | null): ApprovalTemplateState | undefined {
  return value === 'draft' || value === 'enabled' || value === 'disabled' ? value : undefined;
}

export function approvalTaskStatus(value: string | null): ApprovalTaskState | undefined {
  return value === 'pending' || value === 'approved' || value === 'rejected' || value === 'cancelled' || value === 'expired' || value === 'escalated' ? value : undefined;
}

function copyStep(step: ApprovalStep, sequence = step.sequence): ApprovalStep {
  return Object.freeze({ ...step, sequence, approvers: Object.freeze(step.approvers.map((approver) => Object.freeze({ ...approver }))) });
}

function editorDraft(editor: ApprovalEditor | undefined): ApprovalTemplateDraft | undefined {
  return editor?.command === 'create' || editor?.command === 'revise' ? editor.draft : undefined;
}

export function updateApprovalDraft(editor: ApprovalEditor | undefined, draft: ApprovalTemplateDraft | undefined, update: (change: Partial<ApprovalTemplateDraft>) => void): void {
  if (draft !== undefined && editorDraft(editor) !== undefined) update(draft);
}

export function updateApprovalStep(editor: ApprovalEditor | undefined, index: number, update: (step: ApprovalStep) => ApprovalStep): ApprovalTemplateDraft | undefined {
  const draft = editorDraft(editor);
  if (draft === undefined || draft.steps[index] === undefined) return undefined;
  return Object.freeze({ ...draft, steps: Object.freeze(draft.steps.map((step, current) => (current === index ? update(step) : step))) });
}

export function appendApprovalStep(editor: ApprovalEditor | undefined): ApprovalTemplateDraft | undefined {
  const draft = editorDraft(editor);
  return draft === undefined ? undefined : Object.freeze({ ...draft, steps: Object.freeze([...draft.steps, blankStep(draft.steps.length + 1)]) });
}

export function removeApprovalStep(editor: ApprovalEditor | undefined, index: number): ApprovalTemplateDraft | undefined {
  const draft = editorDraft(editor);
  if (draft === undefined || draft.steps.length <= 1) return undefined;
  return Object.freeze({ ...draft, steps: Object.freeze(draft.steps.filter((_, current) => current !== index).map((step, current) => copyStep(step, current + 1))) });
}

export function updateApprovalApprover(editor: ApprovalEditor | undefined, stepIndex: number, approverIndex: number, update: (approver: ApprovalApprover) => ApprovalApprover): ApprovalTemplateDraft | undefined {
  return updateApprovalStep(editor, stepIndex, (step) => Object.freeze({ ...step, approvers: Object.freeze(step.approvers.map((approver, current) => (current === approverIndex ? update(approver) : approver))) }));
}

export function appendApprovalApprover(editor: ApprovalEditor | undefined, stepIndex: number): ApprovalTemplateDraft | undefined {
  return updateApprovalStep(editor, stepIndex, (step) => Object.freeze({ ...step, approvers: Object.freeze([...step.approvers, blankApprover()]) }));
}

export function removeApprovalApprover(editor: ApprovalEditor | undefined, stepIndex: number, approverIndex: number): ApprovalTemplateDraft | undefined {
  return updateApprovalStep(editor, stepIndex, (step) => (step.approvers.length <= 1 ? step : Object.freeze({ ...step, approvers: Object.freeze(step.approvers.filter((_, current) => current !== approverIndex)) })));
}

export function appendApprovalEscalation(editor: ApprovalEditor | undefined): ApprovalTemplateDraft | undefined {
  const draft = editorDraft(editor);
  return draft === undefined ? undefined : Object.freeze({ ...draft, escalations: Object.freeze([...draft.escalations, blankEscalation()]) });
}

export function updateApprovalEscalation(editor: ApprovalEditor | undefined, index: number, update: (escalation: ApprovalEscalation) => ApprovalEscalation): ApprovalTemplateDraft | undefined {
  const draft = editorDraft(editor);
  if (draft === undefined || draft.escalations[index] === undefined) return undefined;
  return Object.freeze({ ...draft, escalations: Object.freeze(draft.escalations.map((escalation, current) => (current === index ? update(escalation) : escalation))) });
}

export function removeApprovalEscalation(editor: ApprovalEditor | undefined, index: number): ApprovalTemplateDraft | undefined {
  const draft = editorDraft(editor);
  return draft === undefined ? undefined : Object.freeze({ ...draft, escalations: Object.freeze(draft.escalations.filter((_, current) => current !== index)) });
}
