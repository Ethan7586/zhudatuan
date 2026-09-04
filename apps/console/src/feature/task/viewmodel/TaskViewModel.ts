import { OP_CHANNEL_CONNECTIONS_READ, OP_RUNTIME_EXPORTS_CANCEL, OP_RUNTIME_IMPORTS_CONFIRM, OP_RUNTIME_IMPORTS_RETRY, OP_RUNTIME_JOBS_CANCEL, OP_RUNTIME_JOBS_READ, OP_RUNTIME_UPLOADS_CREATE } from '@shop/contract/ids';
import { queryCondition, safeQueryError } from '@shop/presentation';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router';
import type { TaskDependencies } from '../../../app/Dependencies';
import type { ConsoleContext } from '../../../entity/session/ConsoleSession';
import { canUseOperation } from '../../../shared/security/OperationAccess';
import { scopeRoutePath } from '../../../shared/url/ScopePath';
import { downloadImportTemplate } from '../../../shared/import/ImportTemplate';
import type { Task, TaskCommand } from '../model/Task';
import { clearTaskImport, readTaskImport } from '../../../shared/task/TaskLaunch';
import { taskSourcePath } from './TaskNavigation';
import { emptyImportDraft, type ImportDraft } from '../model/ImportDraft';
import { canCreateImport, validateImportDraft } from './ImportValidation';
import { activeTask, taskFilter, taskReadOperation } from './TaskState';

export interface TaskSelection {
  readonly type: 'import' | 'export';
  readonly id: string;
}

export function useTaskViewModel(context: ConsoleContext, dependencies: TaskDependencies, requestStepup: () => void, selection?: TaskSelection) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [search, setSearch] = useSearchParams();
  const importRegistrations = dependencies.registry.all();
  const importRequest = readTaskImport(search);
  const filter = useMemo(() => taskFilter(search), [search]);
  const readOperation = taskReadOperation(selection);
  const allowed = canUseOperation(context, readOperation) && context.session.assurance.level >= 2;
  const listKey = Object.freeze(['console', context.scope.kind, context.scope.id, context.session.accessVersion, OP_RUNTIME_JOBS_READ, filter] as const);
  const list = useQuery({
    queryKey: listKey,
    queryFn: ({ signal }) => dependencies.list.execute(context, filter, signal),
    enabled: allowed && selection === undefined,
    refetchInterval: (query) => query.state.data?.items.some((task) => activeTask(task.state)) ? 3_000 : 15_000,
  });
  const detailKey = Object.freeze(['console', context.scope.kind, context.scope.id, context.session.accessVersion, selection?.type ?? null, selection?.id ?? null] as const);
  const detail = useQuery({
    queryKey: detailKey,
    queryFn: ({ signal }) => dependencies.list.read(context, selection!.type, selection!.id, signal),
    enabled: allowed && selection !== undefined,
    refetchInterval: (query) => activeTask(query.state.data?.state) ? 3_000 : false,
  });
  const [command, setCommand] = useState<TaskCommand>();
  const [importDraft, setImportDraft] = useState<ImportDraft | undefined>(() => {
    const registration = importRegistrations.find(({ id }) => id === importRequest.kind);
    return registration ? Object.freeze({ ...emptyImportDraft(registration.id), pool: importRequest.pool ?? '' }) : undefined;
  });
  const [importIdentity, setImportIdentity] = useState(dependencies.createIdentity);
  const [receipt, setReceipt] = useState<string>();
  const providerAllowed = canUseOperation(context, OP_CHANNEL_CONNECTIONS_READ);
  const providers = useQuery({
    queryKey: ['console', context.scope.kind, context.scope.id, context.session.accessVersion, OP_CHANNEL_CONNECTIONS_READ, 'importproviders'],
    queryFn: ({ signal }) => dependencies.readProviders.execute(context, signal),
    enabled: providerAllowed && importDraft?.kind === 'finance' && importDraft.step === 3,
    staleTime: 30_000,
  });
  const mutation = useMutation({
    mutationFn: (input: TaskCommand) => input.kind === 'cancel'
      ? dependencies.cancel.execute(context, input.task, input.reason, input.identity)
      : input.kind === 'confirm' ? dependencies.confirm.execute(context, input.task, input.identity)
      : dependencies.retry.execute(context, input.task, input.reason, input.identity),
    onSuccess: async (task, input) => {
      if (selection !== undefined) queryClient.setQueryData(detailKey, task);
      await queryClient.invalidateQueries({ queryKey: ['console', context.scope.kind, context.scope.id, context.session.accessVersion, OP_RUNTIME_JOBS_READ] });
      setReceipt(input.kind === 'cancel' ? '取消请求已由服务端确认。' : input.kind === 'confirm' ? '预检版本已锁定，导入开始分片执行。' : `重试已受理，可恢复项 ${task.retryableItems} 个。`);
      setCommand(undefined);
    },
  });
  const createImport = useMutation({
    mutationFn: (draft: ImportDraft) => dependencies.createImport.execute(context, draft, importIdentity),
    onSuccess: (task) => {
      setImportDraft(undefined);
      setReceipt('文件已安全上传，服务端正在预检；预检完成后需要你确认才会执行。');
      void navigate(scopeRoutePath(context.scope, 'consoleimporttask', { kind: task.owner, jobId: task.id }));
    },
  });
  const visible = selection === undefined ? list.data?.items : detail.data === undefined ? undefined : Object.freeze([detail.data]);
  const current = selection === undefined ? list : detail;
  const refresh = current.refetch;

  const setFilter = useCallback((key: 'type' | 'state' | 'owner' | 'limit', value: string) => {
    setSearch((currentSearch) => {
      const next = new URLSearchParams(currentSearch);
      next.delete('cursor');
      if (value.length === 0 || (key === 'limit' && value === '20')) next.delete(key);
      else next.set(key, value);
      return next;
    });
  }, [setSearch]);
  const begin = useCallback((kind: TaskCommand['kind'], task: Task) => {
    if (mutation.isPending) return;
    setReceipt(undefined);
    mutation.reset();
    setCommand(Object.freeze({ kind, task, reason: '', identity: dependencies.createIdentity() }));
  }, [dependencies, mutation]);
  const reason = useCallback((value: string) => {
    if (mutation.isPending) return;
    setCommand((currentCommand) => currentCommand === undefined ? undefined : Object.freeze({ ...currentCommand, reason: value.slice(0, 500) }));
    mutation.reset();
  }, [mutation]);
  const submit = useCallback(() => {
    if (command === undefined || (command.kind !== 'confirm' && command.reason.trim().length < 2) || mutation.isPending || context.session.assurance.level < 2) return;
    mutation.mutate(command);
  }, [command, context.session.assurance.level, mutation]);
  const updateImport = useCallback((change: Partial<ImportDraft>) => {
    if (createImport.isPending) return;
    setImportDraft((currentDraft) => currentDraft === undefined ? undefined : Object.freeze({ ...currentDraft, ...change }));
    setImportIdentity(dependencies.createIdentity());
    createImport.reset();
  }, [createImport, dependencies]);
  const importValidation = importDraft && !canCreateImport(context, dependencies.registry, importDraft.kind)
    ? '当前账号没有该类数据的导入权限。'
    : validateImportDraft(importDraft, context.session.assurance.level, providers.data, providers.isPending && providers.isEnabled, safeQueryError(providers.error));
  const availableImports = importRegistrations.filter(({ id }) => canCreateImport(context, dependencies.registry, id));

  return Object.freeze({
    page: list.data,
    tasks: visible,
    selected: detail.data,
    selection,
    filter,
    command,
    importDraft,
    importValidation,
    receipt,
    assurance: context.session.assurance.level,
    condition: allowed
      ? queryCondition({ pending: current.isPending, fetching: current.isFetching, error: current.error, hasData: current.data !== undefined, empty: visible?.length === 0 })
      : 'forbidden',
    error: allowed ? safeQueryError(current.error) : canUseOperation(context, readOperation) ? '任务信息属于敏感数据，请先完成二次验证。' : '当前账号没有查看任务的权限。',
    mutationError: safeQueryError(mutation.error),
    fetching: current.isFetching,
    busy: mutation.isPending,
    importing: Object.freeze({ busy: createImport.isPending, error: safeQueryError(createImport.error) }),
    imports: Object.freeze({
      options: importRegistrations,
      descriptor: importDraft === undefined ? undefined : dependencies.registry.get(importDraft.kind),
    }),
    providers: Object.freeze({
      items: providers.data?.items ?? [],
      pending: providers.isPending && providers.isEnabled,
      error: safeQueryError(providers.error),
      reason: providers.data?.reason ?? null,
    }),
    canCreateImport: canUseOperation(context, OP_RUNTIME_UPLOADS_CREATE) && availableImports.length > 0,
    canImport: (kind: ImportDraft['kind']) => canCreateImport(context, dependencies.registry, kind),
    canCancel: (task: Task) => task.cancellable && canUseOperation(context, task.type === 'export' ? OP_RUNTIME_EXPORTS_CANCEL : OP_RUNTIME_JOBS_CANCEL),
    canConfirm: (task: Task) => task.type === 'import' && task.confirmationRequired && task.previewHash !== null && canUseOperation(context, OP_RUNTIME_IMPORTS_CONFIRM),
    canRetry: (task: Task) => task.type === 'import' && task.retryable && canUseOperation(context, OP_RUNTIME_IMPORTS_RETRY),
    actions: Object.freeze({
      refresh: () => { if (allowed) void refresh(); },
      stepup: requestStepup,
      filter: setFilter,
      reset: () => setSearch((currentSearch) => { const next = new URLSearchParams(currentSearch); for (const key of ['type', 'state', 'owner', 'limit', 'cursor']) next.delete(key); return next; }),
      next: (cursor: string) => setSearch((currentSearch) => { const next = new URLSearchParams(currentSearch); next.set('cursor', cursor); return next; }),
      first: () => setSearch((currentSearch) => { const next = new URLSearchParams(currentSearch); next.delete('cursor'); return next; }),
      begin,
      reason,
      close: () => { if (!mutation.isPending) { setCommand(undefined); mutation.reset(); } },
      submit,
      dismissReceipt: () => setReceipt(undefined),
      openImport: () => { if (!createImport.isPending && availableImports[0]) { setImportDraft(emptyImportDraft(availableImports[0].id)); setImportIdentity(dependencies.createIdentity()); createImport.reset(); } },
      closeImport: () => { if (!createImport.isPending) { setImportDraft(undefined); createImport.reset(); setSearch((currentSearch) => clearTaskImport(currentSearch)); } },
      importStep: (step: 1 | 2 | 3) => updateImport({ step }),
      importKind: (kind: ImportDraft['kind']) => updateImport({ kind, confirmed: false }),
      importFile: (file: File | null) => updateImport({ file, confirmed: false }),
      importField: (field: 'provider' | 'partnerId' | 'periodStart' | 'periodEnd' | 'openingMinor' | 'closingMinor' | 'pool', value: string) => updateImport({ [field]: value, confirmed: false }),
      importConfirmed: (confirmed: boolean) => updateImport({ confirmed }),
      downloadTemplate: () => { if (importDraft) { const descriptor = dependencies.registry.get(importDraft.kind); downloadImportTemplate(descriptor.id, descriptor.columns); } },
      submitImport: () => { if (importDraft && importValidation === undefined && !createImport.isPending) createImport.mutate(importDraft); },
      source: (task: Task) => { void navigate(taskSourcePath(context, task)); },
      channels: () => { void navigate(scopeRoutePath(context.scope, 'consolechannels')); },
      center: () => { void navigate(scopeRoutePath(context.scope, 'consoletasks')); },
    }),
  });
}

export type TaskViewModel = ReturnType<typeof useTaskViewModel>;
