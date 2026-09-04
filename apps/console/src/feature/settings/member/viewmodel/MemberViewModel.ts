import { hasFailureCode, queryCondition, safeQueryError } from '@shop/presentation';
import { useMutation, useQuery } from '@tanstack/react-query';
import { useCallback, useMemo, useState } from 'react';
import { useNavigate } from 'react-router';
import type { MemberDependencies } from '../../../../app/Dependencies';
import type { ConsoleContext } from '../../../../entity/session/ConsoleSession';
import { scopeRoutePath } from '../../../../shared/url/ScopePath';
import type { Member, MemberChange } from '../model/Member';
import { memberConflict, type MemberConflict } from '../model/MemberConflict';
import { memberStatus, validateMember, validateMemberImport, validateRegistrationReset, type MemberEditor, type MemberImportEditor, type MemberImportInput, type MemberManageInput, type RegistrationResetEditor, type RegistrationResetInput } from '../model/MemberEditor';
import { memberAccess } from './MemberAccess';
import { useMemberPaging } from './MemberPaging';

export function useMemberViewModel(context: ConsoleContext, dependencies: MemberDependencies, requestStepup: () => void, refreshIdentity: () => void) {
  const navigate = useNavigate();
  const { cursor, queryKey, next, first } = useMemberPaging(context);
  const query = useQuery({ queryKey, queryFn: ({ signal }) => dependencies.read.execute(context, cursor, signal) });
  const [editor, setEditor] = useState<MemberEditor>();
  const [conflict, setConflict] = useState<MemberConflict>();
  const [importEditor, setImportEditor] = useState<MemberImportEditor>();
  const [registrationEditor, setRegistrationEditor] = useState<RegistrationResetEditor>();
  const [registrationReceipt, setRegistrationReceipt] = useState<Awaited<ReturnType<MemberDependencies['resetRegistration']['execute']>>>();
  const [identity, setIdentity] = useState(dependencies.createIdentity);
  const [importIdentity, setImportIdentity] = useState(dependencies.createIdentity);
  const [registrationIdentity, setRegistrationIdentity] = useState(dependencies.createIdentity);
  const refetch = query.refetch;
  const manage = useMutation({
    mutationFn: async ({ change, identity: requestIdentity }: MemberManageInput) => {
      const receipt = await dependencies.manage.execute(context, change, requestIdentity);
      if (change.kind === 'status' && change.member.membershipId === context.session.membership) return Object.freeze({ receipt, refresh: true });
      const read = await refetch();
      if (read.error) throw read.error;
      return Object.freeze({ receipt, refresh: false });
    },
    onSuccess: ({ refresh }) => {
      setEditor(undefined);
      setConflict(undefined);
      if (refresh) refreshIdentity();
    },
    onError: async (cause, input) => {
      if (!hasFailureCode(cause, 'VERSION_CONFLICT')) return;
      const current = await refetch();
      const latest = current.data?.items.find((member) => member.id === input.change.member.id);
      setConflict(memberConflict(input.change.member, latest));
      if (latest) setEditor((value) => value === undefined ? value : { ...value, member: latest });
      setIdentity(dependencies.createIdentity());
    },
  });
  const createImport = useMutation({
    mutationFn: ({ source, identity: requestIdentity }: MemberImportInput) => dependencies.createImport.execute(context, source, requestIdentity),
    onSuccess: (task) => {
      setImportEditor(undefined);
      void navigate(scopeRoutePath(context.scope, 'consoleimporttask', { kind: 'member', jobId: task.id }));
    },
  });
  const resetRegistration = useMutation({
    mutationFn: ({ draft, identity: requestIdentity }: RegistrationResetInput) => dependencies.resetRegistration.execute(context, draft, requestIdentity),
    onSuccess: (receipt) => {
      setRegistrationEditor((current) => current === undefined ? current : { ...current, ownerPassword: '' });
      setRegistrationReceipt(receipt);
      void refetch();
    },
    onError: () => setRegistrationEditor((current) => current === undefined ? current : { ...current, ownerPassword: '' }),
  });
  const managePending = manage.isPending;
  const importPending = createImport.isPending;
  const registrationPending = resetRegistration.isPending;
  const resetManage = manage.reset;
  const resetImport = createImport.reset;
  const resetRegistrationState = resetRegistration.reset;
  const begin = useCallback(
    (member: Member) => {
      if (managePending) return;
      setEditor({ member, kind: 'profile', displayName: member.displayName, status: memberStatus(member.membershipStatus), reason: '' });
      setConflict(undefined);
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
  const beginRegistrationReset = useCallback(
    (member: Member) => {
      if (registrationPending || !member.registrationResetAllowed) return;
      setRegistrationEditor({ member, reason: '', understood: false, confirmation: '', ownerPassword: '' });
      setRegistrationReceipt(undefined);
      setRegistrationIdentity(dependencies.createIdentity());
      resetRegistrationState();
    },
    [dependencies, registrationPending, resetRegistrationState]
  );
  const updateRegistration = useCallback(
    (change: Partial<Omit<RegistrationResetEditor, 'member'>>) => {
      if (registrationPending) return;
      setRegistrationEditor((current) => (current === undefined ? current : { ...current, ...change }));
      setRegistrationIdentity(dependencies.createIdentity());
      resetRegistrationState();
    },
    [dependencies, registrationPending, resetRegistrationState]
  );
  const validation = validateMember(editor, context.session.assurance.level);
  const importValidation = validateMemberImport(importEditor, context.session.assurance.level);
  const registrationValidation = validateRegistrationReset(registrationEditor, context.session.assurance.level);
  const submit = useCallback(() => {
    if (editor === undefined || conflict !== undefined || validation !== undefined || managePending) return;
    const change: MemberChange =
      editor.kind === 'profile' ? { kind: 'profile', member: editor.member, displayName: editor.displayName, reason: editor.reason } : { kind: 'status', member: editor.member, status: editor.status, reason: editor.reason };
    manage.mutate({ change, identity });
  }, [conflict, editor, identity, manage, managePending, validation]);
  const submitImport = useCallback(() => {
    if (importEditor === undefined || importValidation !== undefined || importPending) return;
    createImport.mutate({ source: { file: importEditor.file! }, identity: importIdentity });
  }, [createImport, importEditor, importIdentity, importPending, importValidation]);
  const submitRegistration = useCallback(() => {
    if (registrationEditor === undefined || registrationValidation !== undefined || registrationPending) return;
    resetRegistration.mutate({ draft: registrationEditor, identity: registrationIdentity });
  }, [registrationEditor, registrationIdentity, registrationPending, registrationValidation, resetRegistration]);
  const refresh = useCallback(() => {
    void refetch();
  }, [refetch]);
  const close = useCallback(() => {
    if (!managePending) { setEditor(undefined); setConflict(undefined); }
  }, [managePending]);
  const closeImport = useCallback(() => {
    if (!importPending) setImportEditor(undefined);
  }, [importPending]);
  const closeRegistration = useCallback(() => {
    if (registrationPending) return;
    setRegistrationEditor(undefined);
    setRegistrationReceipt(undefined);
    resetRegistrationState();
  }, [registrationPending, resetRegistrationState]);
  const { canManage, canImport, canInvite, canResetRegistration } = memberAccess(context);
  const actions = useMemo(
    () =>
      Object.freeze({
        refresh,
        next,
        first,
        begin,
        close,
        resolveConflict: () => setConflict(undefined),
        submit,
        stepup: requestStepup,
        kind: (kind: MemberEditor['kind']) => update({ kind }),
        displayName: (displayName: string) => update({ displayName }),
        status: (status: MemberEditor['status']) => update({ status }),
        reason: (reason: string) => update({ reason }),
        openImport: () => {
          if (!importPending) {
            setImportEditor({ file: null });
            setImportIdentity(dependencies.createIdentity());
            resetImport();
          }
        },
        closeImport,
        importFile: (file: File | null) => updateImport({ file }),
        submitImport,
        beginRegistrationReset,
        closeRegistration,
        registrationReason: (reason: string) => updateRegistration({ reason }),
        registrationUnderstood: (understood: boolean) => updateRegistration({ understood }),
        registrationConfirmation: (confirmation: string) => updateRegistration({ confirmation }),
        registrationPassword: (ownerPassword: string) => updateRegistration({ ownerPassword }),
        submitRegistration,
        inviteAfterReset: () => {
          closeRegistration();
          void navigate(scopeRoutePath(context.scope, 'consoleinvitations'));
        },
      }),
    [begin, beginRegistrationReset, close, closeImport, closeRegistration, context.scope, dependencies, first, importPending, navigate, next, refresh, requestStepup, resetImport, submit, submitImport, submitRegistration, update, updateImport, updateRegistration]
  );
  const page = query.data;
  return Object.freeze({
    page,
    cursor,
    editor,
    importEditor,
    registrationEditor,
    registrationReceipt,
    conflict,
    canManage,
    canImport,
    canInvite,
    canResetRegistration,
    assurance: context.session.assurance.level,
    validation: conflict ? '成员状态已变化，请核对权威差异后重新确认。' : validation,
    importValidation,
    registrationValidation,
    condition: queryCondition({ pending: query.isPending, fetching: query.isFetching, error: query.error, hasData: page !== undefined, empty: page?.items.length === 0 }),
    error: safeQueryError(query.error),
    fetching: query.isFetching,
    manage: Object.freeze({ busy: managePending, error: safeQueryError(manage.error) }),
    importing: Object.freeze({ busy: importPending, error: safeQueryError(createImport.error) }),
    registration: Object.freeze({ busy: registrationPending, error: safeQueryError(resetRegistration.error) }),
    actions,
  });
}
export type MemberViewModel = ReturnType<typeof useMemberViewModel>;
