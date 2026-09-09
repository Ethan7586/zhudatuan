import { OP_CATALOG_IMPORTS_CREATE, OP_RUNTIME_IMPORTS_CONFIRM, OP_RUNTIME_IMPORTS_READ, OP_RUNTIME_UPLOADS_CREATE } from '@shop/contract/ids';
import { isActiveProductImport, presentError } from '@shop/presentation';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router';
import type { ProductDependencies } from '../../../app/Dependencies';
import type { ConsoleContext } from '../../../entity/session/ConsoleSession';
import { identityFor, type CommandIdentity } from '../../../shared/action/CommandIdentity';
import { validateImportFile } from '../../../shared/import/ImportUploadGateway';
import { downloadImportTemplate } from '../../../shared/import/ImportTemplate';
import { canUseOperation } from '../../../shared/security/OperationAccess';
import { scopeRoutePath } from '../../../shared/url/ScopePath';
import type { ProductImport } from '../model/ProductImport';
import { productCommand } from './ProductCommand';

export type ProductImportStep = 1 | 2 | 3 | 4 | 5 | 6;

export function useProductImportViewModel(context: ConsoleContext, dependencies: ProductDependencies, requestStepup: () => void) {
  const navigate = useNavigate();
  const client = useQueryClient();
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<ProductImportStep>(1);
  const [file, setFile] = useState<File | null>(null);
  const [confirmed, setConfirmed] = useState(false);
  const [task, setTask] = useState<ProductImport>();
  const [uploaded, setUploaded] = useState(0);
  const request = { scope: { kind: context.scope.kind, id: context.scope.id }, accessVersion: context.session.accessVersion, ...(context.session.csrf === undefined ? {} : { csrf: context.session.csrf }) } as const;
  const operations = [OP_RUNTIME_UPLOADS_CREATE, OP_CATALOG_IMPORTS_CREATE, OP_RUNTIME_IMPORTS_READ, OP_RUNTIME_IMPORTS_CONFIRM] as const;
  const canOpen = operations.every((operation) => canUseOperation(context, operation));
  const createidentity = useRef<CommandIdentity | undefined>(undefined);
  const confirmidentity = useRef<CommandIdentity | undefined>(undefined);
  const fileFingerprint = file === null ? 'none' : JSON.stringify({ name: file.name, size: file.size, type: file.type, modified: file.lastModified });
  const createKey = identityFor(createidentity, fileFingerprint, dependencies.createIdentity);
  const confirmKey = identityFor(confirmidentity, JSON.stringify({ id: task?.id, version: task?.version, previewHash: task?.previewHash }), dependencies.createIdentity);
  const create = useMutation({
    mutationFn: () => dependencies.createImport.execute(productCommand(context, createKey), file, setUploaded),
    onSuccess: (created) => setTask(created),
  });
  const taskKey = ['console', context.scope.kind, context.scope.id, context.session.accessVersion, OP_RUNTIME_IMPORTS_READ, task?.id ?? null] as const;
  const current = useQuery({
    queryKey: taskKey,
    queryFn: ({ signal }) => dependencies.readImport.execute(request, task!.id, signal),
    enabled: open && task !== undefined,
    refetchInterval: (query) => (waiting(query.state.data ?? task) ? 2_000 : false),
  });
  const confirm = useMutation({
    mutationFn: () => dependencies.confirmImport.execute(productCommand(context, confirmKey), task!),
    onSuccess: (confirmedTask) => {
      setTask(confirmedTask);
      setStep(6);
    },
  });

  useEffect(() => {
    if (current.data !== undefined) setTask(current.data);
  }, [current.data]);
  useEffect(() => {
    if (step !== 4 || task === undefined) return;
    if (task.state === 'ready' && task.previewHash !== null) setStep(5);
    else if (task.state === 'running' || task.state === 'completed') setStep(6);
  }, [step, task]);

  const fileError = file === null ? '请选择 CSV 或 XLSX 文件。' : validateImportFile(file);
  const error = create.error ?? current.error ?? confirm.error;
  const reset = () => {
    setStep(1);
    setFile(null);
    setConfirmed(false);
    setTask(undefined);
    setUploaded(0);
    create.reset();
    client.removeQueries({ queryKey: taskKey });
    confirm.reset();
  };
  return Object.freeze({
    open,
    step,
    file,
    confirmed,
    task,
    uploaded,
    template: dependencies.importTemplate,
    assurance: context.session.assurance.level,
    canOpen,
    permissionReason: canOpen ? undefined : '当前账号缺少商品导入、文件上传或任务确认权限。',
    fileError,
    busy: create.isPending || confirm.isPending,
    refreshing: current.isFetching,
    ...(error === null ? {} : { error: presentError(error).message }),
    actions: Object.freeze({
      open: () => {
        if (canOpen) {
          reset();
          setOpen(true);
        }
      },
      close: () => {
        if (!create.isPending && !confirm.isPending) {
          setOpen(false);
          reset();
        }
      },
      next: () => {
        if (step === 1) setStep(2);
        else if (step === 2 && fileError === undefined) setStep(3);
      },
      back: () => {
        if (!create.isPending && step > 1 && step < 4) setStep((step - 1) as ProductImportStep);
      },
      file: (value: File | null) => {
        if (!create.isPending) {
          setFile(value);
          setConfirmed(false);
          setUploaded(0);
          create.reset();
        }
      },
      confirmed: setConfirmed,
      validate: () => {
        if (!canOpen || fileError !== undefined || !confirmed || create.isPending) return;
        if (context.session.assurance.level < 2) {
          requestStepup();
          return;
        }
        setStep(4);
        setUploaded(0);
        create.mutate();
      },
      confirm: () => {
        if (task !== undefined && context.session.assurance.level >= 2 && !confirm.isPending) confirm.mutate();
      },
      stepup: requestStepup,
      retry: () => {
        if (step === 4 && task === undefined && !create.isPending) create.mutate();
        else void current.refetch();
      },
      restart: () => {
        setTask(undefined);
        setStep(2);
        setConfirmed(false);
        setUploaded(0);
        create.reset();
        client.removeQueries({ queryKey: taskKey });
        confirm.reset();
      },
      download: () => downloadImportTemplate('catalog', dependencies.importTemplate.columns),
      task: () => {
        if (task !== undefined) void navigate(scopeRoutePath(context.scope, 'consoleimporttask', { kind: 'catalog', jobId: task.id }));
      },
    }),
  });
}

export type ProductImportViewModel = ReturnType<typeof useProductImportViewModel>;

function waiting(task: ProductImport | undefined): boolean {
  return isActiveProductImport(task?.state) || (task?.state === 'ready' && task.validationErrors > 0 && !task.downloadAvailable);
}
