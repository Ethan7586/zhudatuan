import { OP_ORGANIZATION_DIRECTORIES_READ, OP_ORGANIZATION_DIRECTORIES_SYNC, OP_ORGANIZATION_DIRECTORIES_SYNCRUNS_READ } from '@shop/contract/ids';
import { queryCondition, safeQueryError } from '@shop/presentation';
import { useMutation, useQuery } from '@tanstack/react-query';
import { useCallback, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router';
import type { DirectoryDependencies } from '../../../../app/Dependencies';
import type { ConsoleContext } from '../../../../entity/session/ConsoleSession';
import { canUseOperation } from '../../../../shared/security/OperationAccess';
import { pageCursor } from '../../../../shared/query/QueryState';
import type { Directory } from '../model/Directory';
import type { DirectoryCommand, DirectorySyncAction, DirectorySyncMode, DirectorySyncRun } from '../model/SyncRun';

export interface SyncEditor {
  readonly action: DirectorySyncAction;
  readonly directory: Directory;
  readonly run?: DirectorySyncRun;
  readonly mode: DirectorySyncMode;
  readonly proof: string;
  readonly confirmed: boolean;
}

export function useDirectoryViewModel(context: ConsoleContext, dependencies: DirectoryDependencies, requestStepup: () => void) {
  const [search, setSearch] = useSearchParams();
  const cursor = search.get('cursor') ?? undefined;
  const runCursor = search.get('runcursor') ?? undefined;
  const directories = useQuery({
    queryKey: ['console', context.scope.kind, context.scope.id, context.session.accessVersion, OP_ORGANIZATION_DIRECTORIES_READ, cursor ?? null, 50],
    queryFn: ({ signal }) => dependencies.read.list(context, cursor, signal),
  });
  const selectedId = search.get('directory') ?? directories.data?.items[0]?.id;
  const runs = useQuery({
    queryKey: ['console', context.scope.kind, context.scope.id, context.session.accessVersion, OP_ORGANIZATION_DIRECTORIES_SYNCRUNS_READ, selectedId ?? null, runCursor ?? null, 20],
    enabled: selectedId !== undefined,
    queryFn: ({ signal }) => dependencies.read.runs(context, selectedId!, runCursor, signal),
    refetchInterval: (state) => (state.state.data?.items.some((run) => run.state === 'queued' || run.state === 'running') ? 3_000 : false),
  });
  const [editor, setEditor] = useState<SyncEditor>();
  const [identity, setIdentity] = useState(dependencies.createIdentity);
  const [receipt, setReceipt] = useState<Readonly<{ id: string; state: string; mode: string; preview: boolean }>>();
  const mutation = useMutation({
    mutationFn: async (command: DirectoryCommand) => {
      const value = command.action === 'start' ? await dependencies.start.execute(context, command) : command.action === 'preview' ? await dependencies.preview.execute(context, command) : command.action === 'cancel' ? await dependencies.cancel.execute(context, command) : await dependencies.resume.execute(context, command);
      const [directoryRead, runRead] = await Promise.all([directories.refetch(), runs.refetch()]);
      if (directoryRead.error) throw directoryRead.error;
      if (runRead.error) throw runRead.error;
      return value;
    },
    onSuccess: (value) => {
      setEditor(undefined);
      setReceipt(value);
    },
  });
  const selected = directories.data?.items.find((item) => item.id === selectedId);
  const open = useCallback(
    (action: SyncEditor['action'], directory: Directory, run?: DirectorySyncRun) => {
      if (mutation.isPending) return;
      mutation.reset();
      setIdentity(dependencies.createIdentity());
      setEditor({ action, directory, ...(run ? { run } : {}), mode: run?.mode === 'full' ? 'full' : 'incremental', proof: '', confirmed: false });
    },
    [dependencies, mutation]
  );
  const update = useCallback(
    (change: Partial<SyncEditor>) => {
      if (mutation.isPending) return;
      const approval = Object.hasOwn(change, 'proof') || Object.hasOwn(change, 'confirmed');
      setEditor((current) => (current ? { ...current, ...change, ...(approval ? {} : { proof: '', confirmed: false }) } : current));
      if (!approval) setIdentity(dependencies.createIdentity());
      mutation.reset();
    },
    [dependencies, mutation]
  );
  const validation = validate(editor, context.session.assurance.level);
  const submit = useCallback(() => {
    if (!editor || validation || mutation.isPending) return;
    const command: DirectoryCommand =
      editor.action === 'start' || editor.action === 'preview'
        ? { action: editor.action, directory: editor.directory.id, mode: editor.mode, proof: editor.proof, identity }
        : { action: editor.action, directory: editor.directory.id, run: editor.run!.id, mode: editor.mode, proof: editor.proof, identity };
    mutation.mutate(command);
  }, [editor, identity, mutation, validation]);
  const select = useCallback(
    (directory: string) =>
      setSearch((current) => {
        const next = new URLSearchParams(current);
        next.set('directory', directory);
        next.delete('runcursor');
        return next;
      }),
    [setSearch]
  );
  const actions = useMemo(
    () =>
      Object.freeze({
        select,
        start: (directory: Directory) => open('start', directory),
        preview: (directory: Directory) => open('preview', directory),
        cancel: (directory: Directory, run: DirectorySyncRun) => open('cancel', directory, run),
        resume: (directory: Directory, run: DirectorySyncRun) => open('resume', directory, run),
        close: () => {
          if (!mutation.isPending) setEditor(undefined);
        },
        mode: (mode: SyncEditor['mode']) => update({ mode }),
        proof: (proof: string) => update({ proof: proof.trim() }),
        confirmed: (confirmed: boolean) => update({ confirmed }),
        submit,
        stepup: requestStepup,
        refresh: () => void Promise.all([directories.refetch(), runs.refetch()]),
        next: (value: string) => setSearch(pageCursor(search, value)),
        first: () =>
          setSearch((current) => {
            const next = new URLSearchParams(current);
            next.delete('cursor');
            return next;
          }),
        nextRun: (value: string) =>
          setSearch((current) => {
            const next = new URLSearchParams(current);
            next.set('runcursor', value);
            return next;
          }),
        firstRun: () =>
          setSearch((current) => {
            const next = new URLSearchParams(current);
            next.delete('runcursor');
            return next;
          }),
        dismissReceipt: () => setReceipt(undefined),
      }),
    [directories, mutation.isPending, open, requestStepup, runs, search, select, setSearch, submit, update]
  );
  return Object.freeze({
    directories: directories.data,
    runs: runs.data,
    selected,
    selectedId,
    cursor,
    runCursor,
    editor,
    receipt,
    validation,
    assurance: context.session.assurance.level,
    canSync: canUseOperation(context, OP_ORGANIZATION_DIRECTORIES_SYNC),
    condition: queryCondition({ pending: directories.isPending, fetching: directories.isFetching, error: directories.error, hasData: directories.data !== undefined, empty: directories.data?.items.length === 0 }),
    error: safeQueryError(directories.error),
    historyError: safeQueryError(runs.error),
    fetching: directories.isFetching || runs.isFetching,
    saving: Object.freeze({ busy: mutation.isPending, error: safeQueryError(mutation.error) }),
    actions,
  });
}

function validate(editor: SyncEditor | undefined, assurance: number): string | undefined {
  if (!editor) return undefined;
  if (editor.directory.status !== 'enabled') return '只有已启用的目录连接可以同步。';
  if (editor.action !== 'start' && editor.action !== 'preview' && !editor.run) return '同步运行不存在，请重读后重试。';
  if (editor.action === 'cancel' && editor.run && !['queued', 'running'].includes(editor.run.state)) return '只能取消排队中或运行中的任务。';
  if (editor.action === 'resume' && editor.run && !['failed', 'cancelled'].includes(editor.run.state)) return '只能恢复失败或已取消的全量/增量任务。';
  if (assurance < 3) return '请先完成高强度二次验证。';
  if (!/^[A-Za-z0-9_-]{43,128}$/.test(editor.proof)) return '请输入 Step-up 签发的一次性操作凭证。';
  if (!editor.confirmed) return '请确认同步模式、连接与影响范围。';
  return undefined;
}
export type DirectoryViewModel = ReturnType<typeof useDirectoryViewModel>;
