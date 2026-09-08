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
import type { ApprovalCommand, ApprovalEditor, ApprovalSubjectKind, ApprovalTemplateDraft } from '../model/Approval';
import { approvalConflict, type ApprovalConflict } from '../model/ApprovalConflict';
import type { ApprovalReadRequest } from '../public';
import { approvalTaskStatus, approvalTemplateStatus, validateApprovalEditor } from './ApprovalEditorState';
import { approvalActions } from './ApprovalActions';
import { useApprovalFilter } from './ApprovalFilter';

export { validateApprovalEditor } from './ApprovalEditorState';

interface MutationInput {
  readonly command: ApprovalCommand;
  readonly identity: string;
}

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
  const templateState = approvalTemplateStatus(search.get('state'));
  const taskState = approvalTaskStatus(search.get('state'));
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
  const { setFilter, setView } = useApprovalFilter(setSearch);
  const actions = useMemo(
    () => approvalActions({
      scope: context.scope,
      subjectKind: dependencies.registry.all()[0]!.id,
      editor,
      search,
      mutationPending: mutation.isPending,
      instanceAllowed,
      refresh,
      requestStepup,
      setView,
      setFilter,
      setSearch,
      navigate: (path) => void navigate(path),
      openEditor,
      closeEditor: () => {
        if (!mutation.isPending) { setEditor(undefined); setConflict(undefined); }
      },
      resolveConflict,
      updateEditor,
      submit,
      setInstance: setInstanceId,
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
