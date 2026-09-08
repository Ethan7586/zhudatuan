import {
  OP_ACCESS_OWNERSHIP_READ,
  OP_ORGANIZATION_LAYERS_READ,
} from '@shop/contract/ids';
import { hasFailureCode, presentError, queryCondition, safeQueryError } from '@shop/presentation';
import { useMutation, useQuery } from '@tanstack/react-query';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router';
import type { AccessDependencies } from '../../../../app/Dependencies';
import type { ConsoleContext } from '../../../../entity/session/ConsoleSession';
import { canUseOperation } from '../../../../shared/security/OperationAccess';
import { pageCursor } from '../../../../shared/query/QueryState';
import type { OwnershipPreview } from '../model/Access';
import { buildAccessChange, validateAccessBody, validateAccessChange, type AccessEditor } from '../model/AccessEditor';
import { accessConflict, type AccessConflict } from '../model/AccessConflict';
import { executeAccess, type AccessMutation } from './AccessCommand';
import { accessQueryKey, clearRoleDraft, ownershipQueryKey, saveRoleDraft, scopeQueryKey, type AccessApproval, type AccessTask, type AccessViewReceipt } from './AccessViewState';
import { accessCapabilities } from './AccessCapability';
import { accessActions } from './AccessActions';
import { useOwnershipClock } from './OwnershipClock';

export type { AccessTask, AccessViewReceipt } from './AccessViewState';

export function useAccessViewModel(context: ConsoleContext, dependencies: AccessDependencies, requestStepup: () => void, refreshIdentity: () => void) {
  const [search, setSearch] = useSearchParams();
  const cursor = search.get('cursor') ?? undefined;
  const requestedTask = search.get('task');
  const task: AccessTask = requestedTask === 'roles' || requestedTask === 'scopes' || requestedTask === 'ownership' ? requestedTask : 'members';
  const canReadOwnership = canUseOperation(context, OP_ACCESS_OWNERSHIP_READ);
  const canReadScopes = canUseOperation(context, OP_ORGANIZATION_LAYERS_READ);
  const query = useQuery({ queryKey: accessQueryKey(context, cursor), queryFn: ({ signal }) => dependencies.read.execute(context, cursor, signal) });
  const ownershipQuery = useQuery({
    queryKey: ownershipQueryKey(context),
    queryFn: ({ signal }) => dependencies.readOwnership.execute(context, signal),
    enabled: canReadOwnership,
  });
  const [editor, setEditor] = useState<AccessEditor>();
  const scopeQuery = useQuery({
    queryKey: scopeQueryKey(context),
    queryFn: ({ signal }) => dependencies.readScopes.execute(context, signal),
    enabled: editor?.kind === 'scope' && canReadScopes,
  });
  const [approval, setApproval] = useState<AccessApproval>({ request: '', busy: false });
  const [identity, setIdentity] = useState(dependencies.createIdentity);
  const [receipt, setReceipt] = useState<AccessViewReceipt>();
  const [conflict, setConflict] = useState<AccessConflict>();
  const approvalVersion = useRef(0);
  const refetch = query.refetch;
  const refetchOwnership = ownershipQuery.refetch;
  const refetchScopes = scopeQuery.refetch;

  const mutation = useMutation({
    mutationFn: async (input: AccessMutation) => {
      const result = await executeAccess(dependencies, context, input);
      const reads = await Promise.all([refetch(), ...(canReadOwnership ? [refetchOwnership()] : [])]);
      const failed = reads.find((read) => read.error);
      if (failed?.error) throw failed.error;
      return result;
    },
    onSuccess: (result, input) => {
      setEditor(undefined);
      setConflict(undefined);
      setReceipt(Object.freeze({ ...result, requestId: input.identity, occurredAt: new Date().toISOString() }));
      if (input.change.kind === 'owner' && input.change.action === 'accept') refreshIdentity();
      if (input.change.kind === 'role' && (input.change.action === 'save' || input.change.action === 'delete')) clearRoleDraft(context.scope.id);
    },
    onError: async (cause) => {
      if (!hasFailureCode(cause, 'VERSION_CONFLICT') || editor === undefined) return;
      const [pageResult, ownershipResult] = await Promise.all([refetch(), ...(canReadOwnership ? [refetchOwnership()] : [])]);
      setConflict(accessConflict(editor, pageResult.data, canReadOwnership ? ownershipResult?.data : ownership));
      setApproval({ request: '', busy: false });
      setIdentity(dependencies.createIdentity());
    },
  });
  const mutationPending = mutation.isPending;
  const resetMutation = mutation.reset;
  const page = query.data;
  const ownership = ownershipQuery.data;
  const scopes = scopeQuery.data ?? Object.freeze([]);
  const permissions = useMemo(() => [...new Set(context.session.permissions)].sort(), [context.session.permissions]);
  const ownerTargets = ownership?.candidates ?? Object.freeze([]);
  const { coolingRemaining, pendingActive } = useOwnershipClock(ownership);
  useEffect(() => {
    if (editor?.kind !== 'role' || editor.action !== 'save') return;
    const save = () => saveRoleDraft(context.scope.id, editor);
    const timer = window.setTimeout(save, 2_000);
    const unload = () => save();
    window.addEventListener('beforeunload', unload);
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener('beforeunload', unload);
      save();
    };
  }, [context.scope.id, editor]);
  const capabilities = useMemo(() => accessCapabilities(context, ownership, canReadScopes, pendingActive, coolingRemaining), [canReadScopes, context, coolingRemaining, ownership, pendingActive]);
  const begin = useCallback(
    (next: AccessEditor) => {
      if (mutationPending) return;
      approvalVersion.current += 1;
      setEditor(next);
      setApproval({ request: '', busy: false });
      setIdentity(dependencies.createIdentity());
      setReceipt(undefined);
      setConflict(undefined);
      resetMutation();
    },
    [dependencies, mutationPending, resetMutation]
  );
  const update = useCallback(
    (transform: (current: AccessEditor) => AccessEditor, proofOnly = false) => {
      if (mutationPending) return;
      setEditor((current) => (current === undefined ? current : transform(current)));
      if (!proofOnly) {
        approvalVersion.current += 1;
        setApproval({ request: '', busy: false });
        setIdentity(dependencies.createIdentity());
        resetMutation();
      }
    },
    [dependencies, mutationPending, resetMutation]
  );
  const change = editor === undefined ? undefined : buildAccessChange(editor);
  const roleConflict = change?.kind === 'role' && change.action === 'save'
    ? page?.separationRules.find((rule) => change.allows.includes(rule.left) && change.allows.includes(rule.right))
    : undefined;
  const validation = conflict ? '权威状态已变化，请应用最新基线并重新生成复核请求。' : roleConflict?.reason ?? validateAccessChange(editor, change, context.session.assurance.level);
  const prepare = useCallback(async () => {
    if (change === undefined || mutation.isPending || approval.busy || conflict) return;
    const bodyError = validateAccessBody(editor, change);
    if (bodyError !== undefined) {
      setApproval({ request: '', busy: false, error: bodyError });
      return;
    }
    const version = approvalVersion.current;
    setApproval({ request: '', busy: true });
    try {
      let preview: OwnershipPreview | undefined;
      if (change.kind === 'owner') preview = await dependencies.owner.preview(context, change, identity);
      const request = await dependencies.prepare.execute(change, context.session.membership, context.scope.id);
      if (approvalVersion.current === version) {
        if (preview !== undefined) setEditor((current) => (current?.kind === 'owner' ? Object.freeze({ ...current, preview }) : current));
        setApproval({ request, busy: false });
      }
    } catch (cause) {
      if (approvalVersion.current === version) setApproval({ request: '', busy: false, error: presentError(cause).message });
    }
  }, [approval.busy, change, conflict, context, dependencies, editor, identity, mutation.isPending]);
  const submit = useCallback(() => {
    if (change === undefined || editor === undefined || validation !== undefined || mutation.isPending) return;
    mutation.mutate({ change, proof: editor.proof, identity });
  }, [change, editor, identity, mutation, validation]);
  const close = useCallback(() => {
    if (!mutationPending) { setEditor(undefined); setConflict(undefined); }
  }, [mutationPending]);
  const resolveConflict = useCallback(() => {
    if (conflict === undefined || mutationPending) return;
    setEditor(conflict.next);
    setConflict(undefined);
    setApproval({ request: '', busy: false });
    setIdentity(dependencies.createIdentity());
    resetMutation();
  }, [conflict, dependencies, mutationPending, resetMutation]);
  const refresh = useCallback(() => {
    void refetch();
    if (canReadOwnership) void refetchOwnership();
  }, [canReadOwnership, refetch, refetchOwnership]);
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
  const actions = useMemo(
    () => accessActions({ scope: context.scope, createIdentity: dependencies.createIdentity, page, ownership, permissions, scopes, begin, update, refresh, refreshScopes: () => void refetchScopes(), next, first, close, resolveConflict, prepare: () => void prepare(), submit, requestStepup, setSearch, dismissReceipt: () => setReceipt(undefined) }),
    [begin, close, context.scope, dependencies.createIdentity, first, next, ownership, page, permissions, prepare, refresh, refetchScopes, requestStepup, resolveConflict, scopes, setSearch, submit, update]
  );

  return Object.freeze({
    page,
    task,
    scope: context.scope,
    scopes,
    scopesPending: scopeQuery.isPending,
    scopeError: safeQueryError(scopeQuery.error),
    ownership,
    coolingRemaining,
    cursor,
    permissions,
    ownerTargets,
    capabilities,
    editor,
    approval,
    receipt,
    conflict,
    validation,
    condition: queryCondition({
      pending: query.isPending,
      fetching: query.isFetching,
      error: query.error,
      hasData: page !== undefined,
      empty: page !== undefined && page.items.length === 0 && page.roles.length === 0,
    }),
    error: safeQueryError(query.error),
    ownershipError: safeQueryError(ownershipQuery.error),
    fetching: query.isFetching || ownershipQuery.isFetching,
    stepupRequired: hasFailureCode(query.error, 'STEPUP_REQUIRED') || hasFailureCode(ownershipQuery.error, 'STEPUP_REQUIRED'),
    mutation: Object.freeze({ busy: mutation.isPending, error: safeQueryError(mutation.error) }),
    actions,
  });
}

export type AccessViewModel = ReturnType<typeof useAccessViewModel>;
