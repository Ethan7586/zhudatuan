import type { ConsoleContext } from '../../../entity/session/ConsoleSession';
import { pageCursor } from '../../../shared/query/QueryState';
import { scopeRoutePath } from '../../../shared/url/ScopePath';
import type { ApprovalApprover, ApprovalEditor, ApprovalEscalation, ApprovalSubjectKind, ApprovalTask, ApprovalTemplate, ApprovalTemplateDraft, ApprovalTemplateVersion } from '../model/Approval';
import {
  appendApprovalApprover,
  appendApprovalEscalation,
  appendApprovalStep,
  approvalDraftFor,
  blankApprovalDraft,
  removeApprovalApprover,
  removeApprovalEscalation,
  removeApprovalStep,
  updateApprovalApprover,
  updateApprovalDraft,
  updateApprovalEscalation,
  updateApprovalStep,
} from './ApprovalEditorState';

interface ApprovalActionInput {
  readonly scope: ConsoleContext['scope'];
  readonly subjectKind: ApprovalSubjectKind;
  readonly editor: ApprovalEditor | undefined;
  readonly search: URLSearchParams;
  readonly mutationPending: boolean;
  readonly instanceAllowed: boolean;
  readonly refresh: () => void;
  readonly requestStepup: () => void;
  readonly setView: (view: 'templates' | 'tasks') => void;
  readonly setFilter: (key: 'state' | 'subject', value: string) => void;
  readonly setSearch: (update: (current: URLSearchParams) => URLSearchParams) => void;
  readonly navigate: (path: string) => void;
  readonly openEditor: (editor: ApprovalEditor) => void;
  readonly closeEditor: () => void;
  readonly resolveConflict: () => void;
  readonly updateEditor: (change: Partial<ApprovalTemplateDraft> | Readonly<{ reason: string }>) => void;
  readonly submit: () => void;
  readonly setInstance: (id: string | undefined) => void;
  readonly retryInstance: () => void;
  readonly dismissReceipt: () => void;
}

export function approvalActions(input: ApprovalActionInput) {
  const updateDraft = (draft: ApprovalTemplateDraft | undefined) => updateApprovalDraft(input.editor, draft, input.updateEditor);
  return Object.freeze({
    refresh: input.refresh,
    stepup: input.requestStepup,
    setView: input.setView,
    state: (value: string) => input.setFilter('state', value),
    subject: (value: string) => input.setFilter('subject', value),
    next: (value: string) => input.setSearch((search) => pageCursor(search, value)),
    first: () => input.setSearch((current) => {
      const next = new URLSearchParams(current);
      next.delete('cursor');
      return next;
    }),
    openTemplate: (template: ApprovalTemplate) => input.navigate(scopeRoutePath(input.scope, 'consoleapprovaltemplate', { templateId: template.id })),
    closeTemplate: () => input.navigate(scopeRoutePath(input.scope, 'consoleapprovals')),
    create: () => input.openEditor({ command: 'create', draft: blankApprovalDraft(input.subjectKind) }),
    revise: (template: ApprovalTemplate, version: ApprovalTemplateVersion) => input.openEditor({ command: 'revise', template, draft: approvalDraftFor(template, version) }),
    enable: (template: ApprovalTemplate) => input.openEditor({ command: 'enable', template, reason: '' }),
    disable: (template: ApprovalTemplate) => input.openEditor({ command: 'disable', template, reason: '' }),
    approve: (task: ApprovalTask) => input.openEditor({ command: 'approve', task, reason: '' }),
    reject: (task: ApprovalTask) => input.openEditor({ command: 'reject', task, reason: '' }),
    close: input.closeEditor,
    resolveConflict: input.resolveConflict,
    field: <TKey extends keyof ApprovalTemplateDraft>(key: TKey, value: ApprovalTemplateDraft[TKey]) => input.updateEditor({ [key]: value }),
    step: (stepIndex: number, key: 'name' | 'dueHours', value: string | number) =>
      updateDraft(updateApprovalStep(input.editor, stepIndex, (step) => Object.freeze({ ...step, [key]: value }))),
    addStep: () => updateDraft(appendApprovalStep(input.editor)),
    removeStep: (stepIndex: number) => updateDraft(removeApprovalStep(input.editor, stepIndex)),
    approver: (stepIndex: number, approverIndex: number, key: keyof ApprovalApprover, value: string | number) =>
      updateDraft(updateApprovalApprover(input.editor, stepIndex, approverIndex, (approver) => Object.freeze({ ...approver, [key]: value }))),
    addApprover: (stepIndex: number) => updateDraft(appendApprovalApprover(input.editor, stepIndex)),
    removeApprover: (stepIndex: number, approverIndex: number) => updateDraft(removeApprovalApprover(input.editor, stepIndex, approverIndex)),
    addEscalation: () => updateDraft(appendApprovalEscalation(input.editor)),
    escalation: (index: number, key: keyof ApprovalEscalation, value: string | number) =>
      updateDraft(updateApprovalEscalation(input.editor, index, (escalation) => Object.freeze({ ...escalation, [key]: value }))),
    removeEscalation: (index: number) => updateDraft(removeApprovalEscalation(input.editor, index)),
    reason: (value: string) => input.updateEditor({ reason: value }),
    submit: input.submit,
    openInstance: (value: string) => input.setInstance(value),
    closeInstance: () => input.setInstance(undefined),
    retryInstance: input.retryInstance,
    dismissReceipt: input.dismissReceipt,
  });
}
