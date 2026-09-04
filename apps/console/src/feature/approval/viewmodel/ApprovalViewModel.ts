import {
  OP_APPROVAL_INSTANCES_GET,
  OP_APPROVAL_TASKS_APPROVE,
  OP_APPROVAL_TASKS_LIST,
  OP_APPROVAL_TASKS_REJECT,
  OP_APPROVAL_TEMPLATES_CREATE,
  OP_APPROVAL_TEMPLATES_DISABLE,
  OP_APPROVAL_TEMPLATES_ENABLE,
  OP_APPROVAL_TEMPLATES_GET,
  OP_APPROVAL_TEMPLATES_LIST,
  OP_APPROVAL_TEMPLATES_REVISE,
} from '@shop/contract/ids';
import { hasFailureCode, queryCondition, safeQueryError, type Receipt } from '@shop/presentation';
import { useMutation, useQuery } from '@tanstack/react-query';
import { useCallback, useMemo, useState } from 'react';
import { useLocation, useNavigate, useSearchParams } from 'react-router';
import type { ApprovalDependencies } from '../../../app/Dependencies';
import type { ConsoleContext } from '../../../entity/session/ConsoleSession';
import { matchRoutePath } from '../../../generated/RouteBinding';
import { canUseOperation } from '../../../shared/security/OperationAccess';
import { pageCursor } from '../../../shared/query/QueryState';
import { scopeRoutePath } from '../../../shared/url/ScopePath';
import type { ApprovalCommand, ApprovalApprover, ApprovalEditor, ApprovalEscalation, ApprovalStep, ApprovalSubjectKind, ApprovalTask, ApprovalTaskState, ApprovalTemplate, ApprovalTemplateDraft, ApprovalTemplateVersion, ApprovalTemplateState } from '../model/Approval';
import { approvalConflict, type ApprovalConflict } from '../model/ApprovalConflict';
import type { ApprovalReadRequest } from '../public';

interface MutationInput {
  readonly command: ApprovalCommand;
  readonly identity: string;
}

const blankApprover = (): ApprovalApprover => Object.freeze({ kind: 'permission', value: '', minimumApprovals: 1 });
const blankStep = (sequence: number): ApprovalStep => Object.freeze({ sequence, name: sequence === 1 ? '业务负责人审批' : `第 ${sequence} 步审批`, approvers: Object.freeze([blankApprover()]), dueHours: 24 });
const blankEscalation = (): ApprovalEscalation => Object.freeze({ afterHours: 24, action: 'notify' });
const blankDraft = (subjectKind: ApprovalSubjectKind): ApprovalTemplateDraft => Object.freeze({ code: '', name: '', subjectKind, steps: Object.freeze([blankStep(1)]), escalations: Object.freeze([]) });

export function useApprovalViewModel(context: ConsoleContext, dependencies: ApprovalDependencies, requestStepup: () => void) {
  const location = useLocation();
  const navigate = useNavigate();
  const [search, setSearch] = useSearchParams();
  const route = matchRoutePath(location.pathname);
  const templateId = route?.id === 'consoleapprovaltemplate' ? route.parameters.templateId : undefined;
  const view = search.get('view') === 'tasks' ? 'tasks' : 'templates';
  const cursor = search.get('cursor') ?? undefined;
  const subjectValue = search.get('subject');
  const subjectKind = subjectValue !== null && dependencies.registry.has(subjectValue) ? subjectValue : undefined;
  const templateState = templateStatus(search.get('state'));
  const taskState = taskStatus(search.get('state'));
  const request = useMemo<ApprovalReadRequest>(
    () =>
      templateId === undefined
        ? view === 'tasks'
          ? { kind: 'tasks', ...(cursor === undefined ? {} : { cursor }), ...(taskState === undefined ? {} : { state: taskState }), ...(subjectKind === undefined ? {} : { subjectKind }) }
          : { kind: 'templates', ...(cursor === undefined ? {} : { cursor }), ...(templateState === undefined ? {} : { state: templateState }), ...(subjectKind === undefined ? {} : { subjectKind }) }
        : { kind: 'template', templateId },
    [cursor, subjectKind, taskState, templateId, templateState, view]
  );
  const readOperation = request.kind === 'template' ? OP_APPROVAL_TEMPLATES_GET : request.kind === 'tasks' ? OP_APPROVAL_TASKS_LIST : OP_APPROVAL_TEMPLATES_LIST;
  const readAllowed = canUseOperation(context, readOperation) && context.session.assurance.level >= 2;
  const query = useQuery({
    queryKey: ['console', context.scope.kind, context.scope.id, context.session.accessVersion, readOperation, request],
    queryFn: ({ signal }) => dependencies.read.execute(context, request, signal),
    enabled: readAllowed,
  });
  const [editor, setEditor] = useState<ApprovalEditor>();
  const [conflict, setConflict] = useState<ApprovalConflict>();
  const [identity, setIdentity] = useState(dependencies.createIdentity);
  const [receipt, setReceipt] = useState<Receipt>();
  const [instanceId, setInstanceId] = useState<string>();
  const instanceAllowed = canUseOperation(context, OP_APPROVAL_INSTANCES_GET) && context.session.assurance.level >= 2;
  const instance = useQuery({
    queryKey: ['console', context.scope.kind, context.scope.id, context.session.accessVersion, OP_APPROVAL_INSTANCES_GET, instanceId ?? null],
    queryFn: ({ signal }) => dependencies.readInstance.execute(context, instanceId!, signal),
    enabled: instanceId !== undefined && instanceAllowed,
  });
  const refetch = query.refetch;
  const mutation = useMutation({
    mutationFn: ({ command, identity: requestIdentity }: MutationInput) => {
      if (command.kind === 'approve' || command.kind === 'reject') return dependencies.decide.execute(context, command, requestIdentity);
      return dependencies.manage.execute(context, command, requestIdentity);
    },
    onSuccess: async (result, input) => {
      const [refreshed, refreshedInstance] = await Promise.all([
        refetch(),
        result.instanceId !== undefined && result.instanceId === instanceId ? instance.refetch() : Promise.resolve(undefined),
      ]);
      if (refreshed.error) throw refreshed.error;
      if (refreshedInstance?.error) throw refreshedInstance.error;
      setEditor(undefined);
      setConflict(undefined);
      setReceipt(Object.freeze({ requestId: input.identity, reference: result.id, occurredAt: new Date().toISOString(), message: `审批操作已提交并完成权威回读，当前状态：${result.state}，版本：${result.version}。` }));
    },
    onError: async (cause) => {
      if (!hasFailureCode(cause, 'VERSION_CONFLICT') || editor === undefined) return;
      const [resourceResult, instanceResult] = await Promise.all([
        refetch(),
        instanceId === undefined ? Promise.resolve(undefined) : instance.refetch(),
      ]);
      setConflict(approvalConflict(editor, resourceResult.data, instanceResult?.data ?? instance.data));
      setIdentity(dependencies.createIdentity());
    },
  });
  const openEditor = useCallback((value: ApprovalEditor) => {
    setIdentity(dependencies.createIdentity());
    setEditor(Object.freeze(value));
    setConflict(undefined);
    mutation.reset();
  }, [dependencies, mutation]);
  const updateEditor = useCallback(
    (change: Partial<ApprovalTemplateDraft> | Readonly<{ reason: string }>) => {
      if (mutation.isPending) return;
      setIdentity(dependencies.createIdentity());
      setEditor((current) => {
        if (current === undefined) return current;
        if (current.command === 'create' || current.command === 'revise') return Object.freeze({ ...current, draft: Object.freeze({ ...current.draft, ...change }) });
        return Object.freeze({ ...current, ...change });
      });
      mutation.reset();
    },
    [dependencies, mutation]
  );
  const submit = useCallback(() => {
    if (editor === undefined || conflict !== undefined || mutation.isPending || validateApprovalEditor(editor, context.session.assurance.level) !== undefined) return;
    let command: ApprovalCommand;
    if (editor.command === 'create') command = { kind: 'create', draft: editor.draft };
    else if (editor.command === 'revise') command = { kind: 'revise', template: editor.template, draft: editor.draft };
    else if (editor.command === 'enable') command = { kind: 'enable', template: editor.template, reason: editor.reason };
    else if (editor.command === 'disable') command = { kind: 'disable', template: editor.template, reason: editor.reason };
    else if (editor.command === 'approve') command = { kind: 'approve', task: editor.task, reason: editor.reason };
    else command = { kind: 'reject', task: editor.task, reason: editor.reason };
    mutation.mutate({ command, identity });
  }, [conflict, context.session.assurance.level, editor, identity, mutation]);
  const resolveConflict = useCallback(() => {
    if (conflict === undefined || mutation.isPending) return;
    setEditor(conflict.next);
    setConflict(undefined);
    setIdentity(dependencies.createIdentity());
    mutation.reset();
  }, [conflict, dependencies, mutation]);
  const refresh = useCallback(() => {
    if (readAllowed) void refetch();
  }, [readAllowed, refetch]);
  const setFilter = useCallback(
    (key: 'state' | 'subject', value: string) => {
      setSearch(
        (current) => {
          const next = new URLSearchParams(current);
          next.delete('cursor');
          if (value.length === 0) next.delete(key);
          else next.set(key, value);
          return next;
        },
        { replace: true }
      );
    },
    [setSearch]
  );
  const setView = useCallback(
    (nextView: 'templates' | 'tasks') => {
      setSearch((current) => {
        const next = new URLSearchParams(current);
        next.delete('cursor');
        next.delete('state');
        if (nextView === 'templates') next.delete('view');
        else next.set('view', nextView);
        return next;
      });
    },
    [setSearch]
  );
  const actions = useMemo(
    () =>
      Object.freeze({
        refresh,
        stepup: requestStepup,
        setView,
        state: (value: string) => setFilter('state', value),
        subject: (value: string) => setFilter('subject', value),
        next: (value: string) => setSearch(pageCursor(search, value)),
        first: () =>
          setSearch((current) => {
            const next = new URLSearchParams(current);
            next.delete('cursor');
            return next;
          }),
        openTemplate: (template: ApprovalTemplate) => void navigate(scopeRoutePath(context.scope, 'consoleapprovaltemplate', { templateId: template.id })),
        closeTemplate: () => void navigate(scopeRoutePath(context.scope, 'consoleapprovals')),
        create: () => openEditor({ command: 'create', draft: blankDraft(dependencies.registry.all()[0]!.id) }),
        revise: (template: ApprovalTemplate, version: ApprovalTemplateVersion) => openEditor({ command: 'revise', template, draft: draftFor(template, version) }),
        enable: (template: ApprovalTemplate) => openEditor({ command: 'enable', template, reason: '' }),
        disable: (template: ApprovalTemplate) => openEditor({ command: 'disable', template, reason: '' }),
        approve: (task: ApprovalTask) => openEditor({ command: 'approve', task, reason: '' }),
        reject: (task: ApprovalTask) => openEditor({ command: 'reject', task, reason: '' }),
        close: () => {
          if (!mutation.isPending) { setEditor(undefined); setConflict(undefined); }
        },
        resolveConflict,
        field: <TKey extends keyof ApprovalTemplateDraft>(key: TKey, value: ApprovalTemplateDraft[TKey]) => updateEditor({ [key]: value }),
        step: (stepIndex: number, key: 'name' | 'dueHours', value: string | number) =>
          updateDraft(
            editor,
            updateStep(editor, stepIndex, (step) => Object.freeze({ ...step, [key]: value })),
            updateEditor
          ),
        addStep: () => updateDraft(editor, appendStep(editor), updateEditor),
        removeStep: (stepIndex: number) => updateDraft(editor, removeStep(editor, stepIndex), updateEditor),
        approver: (stepIndex: number, approverIndex: number, key: keyof ApprovalApprover, value: string | number) =>
          updateDraft(
            editor,
            updateApprover(editor, stepIndex, approverIndex, (approver) => Object.freeze({ ...approver, [key]: value })),
            updateEditor
          ),
        addApprover: (stepIndex: number) => updateDraft(editor, appendApprover(editor, stepIndex), updateEditor),
        removeApprover: (stepIndex: number, approverIndex: number) => updateDraft(editor, removeApprover(editor, stepIndex, approverIndex), updateEditor),
        addEscalation: () => updateDraft(editor, appendEscalation(editor), updateEditor),
        escalation: (index: number, key: keyof ApprovalEscalation, value: string | number) =>
          updateDraft(
            editor,
            updateEscalation(editor, index, (escalation) => Object.freeze({ ...escalation, [key]: value })),
            updateEditor
          ),
        removeEscalation: (index: number) => updateDraft(editor, removeEscalation(editor, index), updateEditor),
        reason: (value: string) => updateEditor({ reason: value }),
        submit,
        openInstance: (value: string) => setInstanceId(value),
        closeInstance: () => setInstanceId(undefined),
        retryInstance: () => {
          if (instanceAllowed) void instance.refetch();
        },
        dismissReceipt: () => setReceipt(undefined),
      }),
    [context.scope, dependencies, editor, instance, instanceAllowed, mutation, navigate, openEditor, refresh, requestStepup, resolveConflict, search, setFilter, setSearch, setView, submit, updateEditor]
  );
  const capabilities = Object.freeze({
    create: canUseOperation(context, OP_APPROVAL_TEMPLATES_CREATE),
    revise: canUseOperation(context, OP_APPROVAL_TEMPLATES_REVISE),
    enable: canUseOperation(context, OP_APPROVAL_TEMPLATES_ENABLE),
    disable: canUseOperation(context, OP_APPROVAL_TEMPLATES_DISABLE),
    approve: canUseOperation(context, OP_APPROVAL_TASKS_APPROVE),
    reject: canUseOperation(context, OP_APPROVAL_TASKS_REJECT),
  });
  const page = query.data;
  return Object.freeze({
    view,
    cursor,
    subjectKind,
    subjects: dependencies.registry.all(),
    subjectLabel: (value: ApprovalSubjectKind) => dependencies.registry.get(value).label,
    state: request.kind === 'tasks' ? taskState : templateState,
    page,
    editor,
    conflict,
    instance: instance.data,
    instanceOpen: instanceId !== undefined,
    instanceCondition: queryCondition({ pending: instance.isPending, fetching: instance.isFetching, error: instance.error, hasData: instance.data !== undefined, empty: false }),
    instanceError: safeQueryError(instance.error),
    capabilities,
    assurance: context.session.assurance.level,
    receipt,
    condition: readAllowed
      ? queryCondition({ pending: query.isPending, fetching: query.isFetching, error: query.error, hasData: page !== undefined, empty: page === undefined ? false : page.kind === 'template' ? false : page.items.length === 0 })
      : 'forbidden',
    error: readAllowed ? safeQueryError(query.error) : canUseOperation(context, readOperation) ? '审批数据属于敏感信息，请先完成二次验证。' : '当前账号没有查看审批数据的权限。',
    fetching: query.isFetching,
    busy: mutation.isPending,
    mutationError: safeQueryError(mutation.error),
    validation: conflict ? '权威状态已变化，请应用最新基线并重新复核。' : validateApprovalEditor(editor, context.session.assurance.level),
    actions,
  });
}

export type ApprovalViewModel = ReturnType<typeof useApprovalViewModel>;

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

function draftFor(template: ApprovalTemplate, version: Readonly<{ steps: readonly ApprovalStep[]; escalations: readonly ApprovalEscalation[] }>): ApprovalTemplateDraft {
  return Object.freeze({
    code: template.code,
    name: template.name,
    subjectKind: template.subjectKind,
    steps: Object.freeze(version.steps.map(copyStep)),
    escalations: Object.freeze(version.escalations.map((item) => Object.freeze({ ...item }))),
  });
}
function templateStatus(value: string | null): ApprovalTemplateState | undefined {
  return value === 'draft' || value === 'enabled' || value === 'disabled' ? value : undefined;
}
function taskStatus(value: string | null): ApprovalTaskState | undefined {
  return value === 'pending' || value === 'approved' || value === 'rejected' || value === 'cancelled' || value === 'expired' || value === 'escalated' ? value : undefined;
}

function copyStep(step: ApprovalStep, sequence = step.sequence): ApprovalStep {
  return Object.freeze({ ...step, sequence, approvers: Object.freeze(step.approvers.map((approver) => Object.freeze({ ...approver }))) });
}
function editorDraft(editor: ApprovalEditor | undefined): ApprovalTemplateDraft | undefined {
  return editor?.command === 'create' || editor?.command === 'revise' ? editor.draft : undefined;
}
function updateDraft(editor: ApprovalEditor | undefined, draft: ApprovalTemplateDraft | undefined, update: (change: Partial<ApprovalTemplateDraft>) => void): void {
  if (draft !== undefined && editorDraft(editor) !== undefined) update(draft);
}
function updateStep(editor: ApprovalEditor | undefined, index: number, update: (step: ApprovalStep) => ApprovalStep): ApprovalTemplateDraft | undefined {
  const draft = editorDraft(editor);
  if (draft === undefined || draft.steps[index] === undefined) return undefined;
  return Object.freeze({ ...draft, steps: Object.freeze(draft.steps.map((step, current) => (current === index ? update(step) : step))) });
}
function appendStep(editor: ApprovalEditor | undefined): ApprovalTemplateDraft | undefined {
  const draft = editorDraft(editor);
  return draft === undefined ? undefined : Object.freeze({ ...draft, steps: Object.freeze([...draft.steps, blankStep(draft.steps.length + 1)]) });
}
function removeStep(editor: ApprovalEditor | undefined, index: number): ApprovalTemplateDraft | undefined {
  const draft = editorDraft(editor);
  if (draft === undefined || draft.steps.length <= 1) return undefined;
  return Object.freeze({ ...draft, steps: Object.freeze(draft.steps.filter((_, current) => current !== index).map((step, current) => copyStep(step, current + 1))) });
}
function updateApprover(editor: ApprovalEditor | undefined, stepIndex: number, approverIndex: number, update: (approver: ApprovalApprover) => ApprovalApprover): ApprovalTemplateDraft | undefined {
  return updateStep(editor, stepIndex, (step) => Object.freeze({ ...step, approvers: Object.freeze(step.approvers.map((approver, current) => (current === approverIndex ? update(approver) : approver))) }));
}
function appendApprover(editor: ApprovalEditor | undefined, stepIndex: number): ApprovalTemplateDraft | undefined {
  return updateStep(editor, stepIndex, (step) => Object.freeze({ ...step, approvers: Object.freeze([...step.approvers, blankApprover()]) }));
}
function removeApprover(editor: ApprovalEditor | undefined, stepIndex: number, approverIndex: number): ApprovalTemplateDraft | undefined {
  return updateStep(editor, stepIndex, (step) => (step.approvers.length <= 1 ? step : Object.freeze({ ...step, approvers: Object.freeze(step.approvers.filter((_, current) => current !== approverIndex)) })));
}
function appendEscalation(editor: ApprovalEditor | undefined): ApprovalTemplateDraft | undefined {
  const draft = editorDraft(editor);
  return draft === undefined ? undefined : Object.freeze({ ...draft, escalations: Object.freeze([...draft.escalations, blankEscalation()]) });
}
function updateEscalation(editor: ApprovalEditor | undefined, index: number, update: (escalation: ApprovalEscalation) => ApprovalEscalation): ApprovalTemplateDraft | undefined {
  const draft = editorDraft(editor);
  if (draft === undefined || draft.escalations[index] === undefined) return undefined;
  return Object.freeze({ ...draft, escalations: Object.freeze(draft.escalations.map((escalation, current) => (current === index ? update(escalation) : escalation))) });
}
function removeEscalation(editor: ApprovalEditor | undefined, index: number): ApprovalTemplateDraft | undefined {
  const draft = editorDraft(editor);
  return draft === undefined ? undefined : Object.freeze({ ...draft, escalations: Object.freeze(draft.escalations.filter((_, current) => current !== index)) });
}
