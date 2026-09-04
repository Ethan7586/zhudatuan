import {
  OP_CHANNEL_CONNECTIONS_READ,
  OP_FINANCE_STATEMENTIMPORTS_CREATE,
  OP_FINANCE_STATEMENTIMPORTS_READ,
  OP_RUNTIME_IMPORTS_CONFIRM,
  OP_RUNTIME_IMPORTS_READ,
  OP_RUNTIME_JOBS_READ,
  OP_RUNTIME_UPLOADS_CREATE,
} from '@shop/contract/ids';
import { presentError, safeQueryError } from '@shop/presentation';
import { useMutation, useQuery } from '@tanstack/react-query';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router';
import type { FinanceDependencies } from '../../../app/Dependencies';
import type { ConsoleContext } from '../../../entity/session/ConsoleSession';
import { downloadImportTemplate } from '../../../shared/import/ImportTemplate';
import { validateImportFile } from '../../../shared/import/ImportUploadGateway';
import { STATEMENT_IMPORT_TEMPLATE } from '../../../shared/import/StatementImport';
import { canUseOperation } from '../../../shared/security/OperationAccess';
import { scopeRoutePath } from '../../../shared/url/ScopePath';
import { emptyFinanceImportDraft, validateFinanceImportDraft, type FinanceImportDraft, type FinanceImportTask } from '../model/FinanceImport';

export type FinanceImportStep = 1 | 2 | 3 | 4 | 5 | 6;

const importOperations = [
  OP_RUNTIME_UPLOADS_CREATE,
  OP_FINANCE_STATEMENTIMPORTS_CREATE,
  OP_FINANCE_STATEMENTIMPORTS_READ,
  OP_CHANNEL_CONNECTIONS_READ,
  OP_RUNTIME_JOBS_READ,
  OP_RUNTIME_IMPORTS_READ,
  OP_RUNTIME_IMPORTS_CONFIRM,
] as const;

export function useFinanceImportViewModel(context: ConsoleContext, dependencies: FinanceDependencies, requestStepup: () => void) {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<FinanceImportStep>(1);
  const [draft, setDraft] = useState<FinanceImportDraft>(emptyFinanceImportDraft);
  const [task, setTask] = useState<FinanceImportTask>();
  const [uploaded, setUploaded] = useState(0);
  const [identity, setIdentity] = useState(dependencies.createIdentity);
  const scope = `${context.scope.kind}:${context.scope.id}`;
  const previousScope = useRef(scope);
  const canOpen = importOperations.every((operation) => canUseOperation(context, operation));
  const providers = useQuery({
    queryKey: ['console', context.scope.kind, context.scope.id, context.session.accessVersion, OP_CHANNEL_CONNECTIONS_READ, 'statementimport'],
    queryFn: ({ signal }) => dependencies.readImportProviders.execute(context, signal),
    enabled: open && canOpen,
    staleTime: 30_000,
  });
  const create = useMutation({
    mutationFn: () => dependencies.createImport.execute(context, draft, identity, setUploaded),
    onSuccess: (created) => {
      setTask(created);
      setStep(importStep(created));
    },
  });
  const current = useQuery({
    queryKey: ['console', context.scope.kind, context.scope.id, context.session.accessVersion, OP_FINANCE_STATEMENTIMPORTS_READ, task?.id ?? null],
    queryFn: ({ signal }) => dependencies.readImport.execute(context, task!.id, signal),
    enabled: open && task !== undefined && canOpen,
    refetchInterval: (query) => activeImport(query.state.data?.state ?? task?.state) ? 2_000 : false,
  });
  useEffect(() => {
    if (!current.data) return;
    setTask(current.data);
    setStep(importStep(current.data));
  }, [current.data]);
  useEffect(() => {
    if (previousScope.current === scope) return;
    previousScope.current = scope;
    setOpen(false);
    setStep(1);
    setDraft(emptyFinanceImportDraft());
    setTask(undefined);
    setUploaded(0);
    setIdentity(dependencies.createIdentity());
  }, [dependencies, scope]);

  const provider = providers.data?.items.find(({ value }) => value === draft.provider);
  const validation = useMemo(() => {
    if (step === 1) {
      if (providers.isPending) return '正在读取当前范围的渠道目录。';
      if (providers.error) return safeQueryError(providers.error) ?? '渠道目录暂时不可用。';
      if (!providers.data?.items.length) return providers.data?.reason ?? '当前范围没有可用于账单导入的渠道。';
      return provider ? undefined : '请选择账单来源渠道。';
    }
    if (step === 2) return draft.file ? validateImportFile(draft.file) : '请选择 CSV 或 XLSX 账单文件。';
    if (step === 3) return validateFinanceImportDraft(draft, providers.data);
    return undefined;
  }, [draft, provider, providers.data, providers.error, providers.isPending, step]);
  const update = <TKey extends keyof FinanceImportDraft>(key: TKey, value: FinanceImportDraft[TKey]) => {
    if (create.isPending) return;
    setDraft((currentDraft) => Object.freeze({ ...currentDraft, [key]: value, ...(key === 'confirmed' ? {} : { confirmed: false }) }));
    setUploaded(0);
    setIdentity(dependencies.createIdentity());
    create.reset();
  };
  const reset = () => {
    setStep(1);
    setDraft(emptyFinanceImportDraft());
    setTask(undefined);
    setUploaded(0);
    setIdentity(dependencies.createIdentity());
    create.reset();
  };
  const goTask = () => {
    if (!task) return;
    setOpen(false);
    void navigate(scopeRoutePath(context.scope, 'consoleimporttask', { kind: 'finance', jobId: task.id }));
  };
  return Object.freeze({
    open,
    step,
    draft,
    task,
    provider,
    providers: Object.freeze({ items: providers.data?.items ?? [], reason: providers.data?.reason ?? null, pending: providers.isPending, error: safeQueryError(providers.error) }),
    template: STATEMENT_IMPORT_TEMPLATE,
    uploaded,
    validation,
    canOpen,
    assurance: context.session.assurance.level,
    busy: create.isPending,
    refreshing: current.isFetching,
    error: create.error ? presentError(create.error).message : current.error ? presentError(current.error).message : undefined,
    permissionReason: canOpen ? undefined : '当前账号缺少安全上传、渠道目录、财务账单导入或任务确认权限。',
    actions: Object.freeze({
      open: () => { if (canOpen) { reset(); setOpen(true); } },
      close: () => { if (!create.isPending) { setOpen(false); reset(); } },
      next: () => { if (validation === undefined && step < 3) setStep((step + 1) as FinanceImportStep); },
      back: () => { if (!create.isPending && step > 1 && step < 4) setStep((step - 1) as FinanceImportStep); },
      provider: (value: string) => update('provider', value),
      file: (value: File | null) => update('file', value),
      partner: (value: string) => update('partnerId', value),
      start: (value: string) => update('periodStart', value),
      end: (value: string) => update('periodEnd', value),
      opening: (value: string) => update('openingMinor', value),
      closing: (value: string) => update('closingMinor', value),
      confirmed: (value: boolean) => update('confirmed', value),
      submit: () => {
        if (validation !== undefined || create.isPending) return;
        if (context.session.assurance.level < 2) { requestStepup(); return; }
        create.mutate();
      },
      retry: () => { if (!create.isPending) create.mutate(); },
      refresh: () => { if (task) void current.refetch(); },
      stepup: requestStepup,
      download: () => downloadImportTemplate('finance-statement', STATEMENT_IMPORT_TEMPLATE.columns),
      task: goTask,
    }),
  });
}

export type FinanceImportViewModel = ReturnType<typeof useFinanceImportViewModel>;

function importStep(task: FinanceImportTask): FinanceImportStep {
  if (task.state === 'ready') return 5;
  if (['running', 'reporting', 'completed', 'failed', 'cancelled', 'expired'].includes(task.state)) return 6;
  return 4;
}

function activeImport(state: string | undefined): boolean {
  return state !== undefined && ['uploaded', 'queued', 'scanning', 'validating', 'preflight', 'running', 'reporting'].includes(state);
}
