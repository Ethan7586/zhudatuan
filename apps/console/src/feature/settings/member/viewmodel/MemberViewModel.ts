import { OP_IDENTITY_MEMBERS_MANAGE, OP_MEMBER_IMPORTS_CREATE, OP_MEMBER_MEMBERS_READ } from '@shop/contract/ids';
import { queryCondition, safeQueryError } from '@shop/presentation';
import { useMutation, useQuery } from '@tanstack/react-query';
import { useCallback, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router';
import type { MemberDependencies } from '../../../../app/Dependencies';
import type { ConsoleContext } from '../../../../entity/session/ConsoleSession';
import { canUseOperation } from '../../../../shared/security/OperationAccess';
import { pageCursor } from '../../../../shared/url/PageCursor';
import { scopeRoutePath } from '../../../../shared/url/ScopePath';
import type { Member, MemberChange, MemberImportSource } from '../model/Member';

export interface MemberEditor {
  readonly member: Member;
  readonly kind: 'profile' | 'status';
  readonly displayName: string;
  readonly status: 'active' | 'suspended' | 'left';
  readonly reason: string;
}
export interface MemberImportEditor {
  readonly objectRef: string;
  readonly sha256: string;
}
interface ManageInput {
  readonly change: MemberChange;
  readonly identity: string;
}
interface ImportInput {
  readonly source: MemberImportSource;
  readonly identity: string;
}

export function useMemberViewModel(context: ConsoleContext, dependencies: MemberDependencies, requestStepup: () => void, refreshIdentity: () => void) {
  const navigate = useNavigate();
  const [search, setSearch] = useSearchParams();
  const cursor = search.get('cursor') ?? undefined;
  const query = useQuery({ queryKey: memberQueryKey(context, cursor), queryFn: ({ signal }) => dependencies.read.execute(context, cursor, signal) });
  const [editor, setEditor] = useState<MemberEditor>();
  const [importEditor, setImportEditor] = useState<MemberImportEditor>();
  const [identity, setIdentity] = useState(dependencies.createIdentity);
  const [importIdentity, setImportIdentity] = useState(dependencies.createIdentity);
  const refetch = query.refetch;
  const manage = useMutation({
    mutationFn: async ({ change, identity: requestIdentity }: ManageInput) => {
      const receipt = await dependencies.manage.execute(context, change, requestIdentity);
      if (change.kind === 'status' && change.member.membershipId === context.session.membership) return Object.freeze({ receipt, refresh: true });
      const read = await refetch();
      if (read.error) throw read.error;
      return Object.freeze({ receipt, refresh: false });
    },
    onSuccess: ({ refresh }) => {
      setEditor(undefined);
      if (refresh) refreshIdentity();
    },
  });
  const createImport = useMutation({
    mutationFn: ({ source, identity: requestIdentity }: ImportInput) => dependencies.createImport.execute(context, source, requestIdentity),
    onSuccess: (task) => {
      setImportEditor(undefined);
      void navigate(scopeRoutePath(context.scope, 'consoleimporttask', { kind: 'member', jobId: task.id }));
    },
  });
  const managePending = manage.isPending;
  const importPending = createImport.isPending;
  const resetManage = manage.reset;
  const resetImport = createImport.reset;
  const begin = useCallback(
    (member: Member) => {
      if (managePending) return;
      setEditor({ member, kind: 'profile', displayName: member.displayName, status: memberStatus(member.membershipStatus), reason: '' });
      setIdentity(dependencies.createIdentity());
      resetManage();
    },
    [dependencies, managePending, resetManage]
  );
  const update = useCallback(
    (change: Partial<Omit<MemberEditor, 'member'>>) => {
      if (managePending) return;
      setEditor((current) => (current === undefined ? current : { ...current, ...change }));
      setIdentity(dependencies.createIdentity());
      resetManage();
    },
    [dependencies, managePending, resetManage]
  );
  const updateImport = useCallback(
    (change: Partial<MemberImportEditor>) => {
      if (importPending) return;
      setImportEditor((current) => (current === undefined ? current : { ...current, ...change }));
      setImportIdentity(dependencies.createIdentity());
      resetImport();
    },
    [dependencies, importPending, resetImport]
  );
  const validation = validateEditor(editor, context.session.assurance.level);
  const importValidation = validateImport(importEditor, context.session.assurance.level);
  const submit = useCallback(() => {
    if (editor === undefined || validation !== undefined || managePending) return;
    const change: MemberChange =
      editor.kind === 'profile' ? { kind: 'profile', member: editor.member, displayName: editor.displayName, reason: editor.reason } : { kind: 'status', member: editor.member, status: editor.status, reason: editor.reason };
    manage.mutate({ change, identity });
  }, [editor, identity, manage, managePending, validation]);
  const submitImport = useCallback(() => {
    if (importEditor === undefined || importValidation !== undefined || importPending) return;
    createImport.mutate({ source: { objectRef: importEditor.objectRef.trim(), sha256: importEditor.sha256.trim().toLowerCase() }, identity: importIdentity });
  }, [createImport, importEditor, importIdentity, importPending, importValidation]);
  const refresh = useCallback(() => {
    void refetch();
  }, [refetch]);
  const next = useCallback((value: string) => setSearch(pageCursor(search, value)), [search, setSearch]);
  const first = useCallback(
    () =>
      setSearch((current) => {
        const value = new URLSearchParams(current);
        value.delete('cursor');
        return value;
      }),
    [setSearch]
  );
  const close = useCallback(() => {
    if (!managePending) setEditor(undefined);
  }, [managePending]);
  const closeImport = useCallback(() => {
    if (!importPending) setImportEditor(undefined);
  }, [importPending]);
  const canManage = canUseOperation(context, OP_IDENTITY_MEMBERS_MANAGE);
  const canImport = canUseOperation(context, OP_MEMBER_IMPORTS_CREATE);
  const actions = useMemo(
    () =>
      Object.freeze({
        refresh,
        next,
        first,
        begin,
        close,
        submit,
        stepup: requestStepup,
        kind: (kind: MemberEditor['kind']) => update({ kind }),
        displayName: (displayName: string) => update({ displayName }),
        status: (status: MemberEditor['status']) => update({ status }),
        reason: (reason: string) => update({ reason }),
        openImport: () => {
          if (!importPending) {
            setImportEditor({ objectRef: '', sha256: '' });
            setImportIdentity(dependencies.createIdentity());
            resetImport();
          }
        },
        closeImport,
        objectRef: (objectRef: string) => updateImport({ objectRef }),
        sha256: (sha256: string) => updateImport({ sha256 }),
        submitImport,
      }),
    [begin, close, closeImport, dependencies, first, importPending, next, refresh, requestStepup, resetImport, submit, submitImport, update, updateImport]
  );
  const page = query.data;
  return Object.freeze({
    page,
    cursor,
    editor,
    importEditor,
    canManage,
    canImport,
    assurance: context.session.assurance.level,
    validation,
    importValidation,
    condition: queryCondition({ pending: query.isPending, fetching: query.isFetching, error: query.error, hasData: page !== undefined, empty: page?.items.length === 0 }),
    error: safeQueryError(query.error),
    fetching: query.isFetching,
    manage: Object.freeze({ busy: managePending, error: safeQueryError(manage.error) }),
    importing: Object.freeze({ busy: importPending, error: safeQueryError(createImport.error) }),
    actions,
  });
}

function memberQueryKey(context: ConsoleContext, cursor?: string) {
  return Object.freeze(['console', context.scope.kind, context.scope.id, context.session.accessVersion, OP_MEMBER_MEMBERS_READ, cursor ?? null, 50] as const);
}
function memberStatus(value: string): MemberEditor['status'] {
  return value === 'suspended' || value === 'left' ? value : 'active';
}
function validateEditor(editor: MemberEditor | undefined, assurance: number): string | undefined {
  if (editor === undefined) return undefined;
  if (editor.kind === 'profile' && (editor.displayName.trim().length === 0 || editor.displayName.trim().length > 128)) return '显示名称需为 1 至 128 个字符。';
  if (editor.kind === 'profile' ? editor.displayName.trim() === editor.member.displayName : editor.status === memberStatus(editor.member.membershipStatus)) return '请先修改成员资料或状态。';
  if (editor.reason.trim().length < 4 || editor.reason.trim().length > 1000) return '请填写 4 至 1000 字的审计原因。';
  return assurance < 2 ? '请先完成二次验证。' : undefined;
}
function validateImport(editor: MemberImportEditor | undefined, assurance: number): string | undefined {
  if (editor === undefined) return undefined;
  if (!editor.objectRef.trim()) return '请选择安全文件库中的 CSV 文件。';
  if (!/^[a-f0-9]{64}$/i.test(editor.sha256.trim())) return '请输入文件上传完成后返回的 64 位 SHA-256 校验值。';
  return assurance < 2 ? '请先完成二次验证。' : undefined;
}
export type MemberViewModel = ReturnType<typeof useMemberViewModel>;
