import { OP_ACCESS_CENTER_READ, OP_ACCESS_OVERRIDES_MANAGE, OP_ACCESS_OWNERS_TRANSFER, OP_ACCESS_ROLES_MANAGE, OP_ACCESS_SCOPES_MANAGE } from '@shop/contract/ids';
import { hasFailureCode, presentError, queryCondition, safeQueryError } from '@shop/presentation';
import { useMutation, useQuery } from '@tanstack/react-query';
import { useCallback, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router';
import type { AccessDependencies } from '../../../../app/Dependencies';
import type { ConsoleContext } from '../../../../entity/session/ConsoleSession';
import { canUseOperation } from '../../../../shared/security/OperationAccess';
import { pageCursor } from '../../../../shared/url/PageCursor';
import type { AccessEffect, AccessMembership, AccessReceipt, AccessRole, AccessScopeKind } from '../model/Access';
import { buildAccessChange, selectPermission, validateAccessBody, validateAccessChange, type AccessEditor } from '../model/AccessEditor';
import { executeAccess, type AccessMutation } from './AccessCommand';
interface ApprovalState {
  readonly request: string;
  readonly busy: boolean;
  readonly error?: string;
}
export interface AccessViewReceipt extends AccessReceipt {
  readonly requestId: string;
  readonly occurredAt: string;
}
export function useAccessViewModel(context: ConsoleContext, dependencies: AccessDependencies, requestStepup: () => void, refreshIdentity: () => void) {
  const [search, setSearch] = useSearchParams();
  const cursor = search.get('cursor') ?? undefined;
  const query = useQuery({ queryKey: accessQueryKey(context, cursor), queryFn: ({ signal }) => dependencies.read.execute(context, cursor, signal) });
  const [editor, setEditor] = useState<AccessEditor>();
  const [approval, setApproval] = useState<ApprovalState>({ request: '', busy: false });
  const [identity, setIdentity] = useState(dependencies.createIdentity);
  const [receipt, setReceipt] = useState<AccessViewReceipt>();
  const approvalVersion = useRef(0);
  const refetch = query.refetch;

  const mutation = useMutation({
    mutationFn: async (input: AccessMutation) => {
      const result = await executeAccess(dependencies, context, input);
      if (input.change.kind !== 'owner') {
        const read = await refetch();
        if (read.error) throw read.error;
      }
      return result;
    },
    onSuccess: (result, input) => {
      setEditor(undefined);
      setReceipt(Object.freeze({ ...result, requestId: input.identity, occurredAt: new Date().toISOString() }));
      if (input.change.kind === 'owner') refreshIdentity();
    },
  });
  const mutationPending = mutation.isPending;
  const resetMutation = mutation.reset;
  const page = query.data;
  const permissions = useMemo(() => [...new Set(context.session.permissions)].sort(), [context.session.permissions]);
  const canTransferOwner = canUseOperation(context, OP_ACCESS_OWNERS_TRANSFER);
  const owner = useMemo(
    () => page?.items.find((item) => item.id === context.session.membership && item.roles.some((role) => role.kind === 'owner')) ?? (canTransferOwner ? currentMembership(context) : undefined),
    [canTransferOwner, context, page?.items]
  );
  const ownerTargets = useMemo(() => page?.items.filter((item) => item.id !== owner?.id && item.client === 'console' && item.status === 'active') ?? [], [owner?.id, page?.items]);
  const capabilities = useMemo(
    () =>
      Object.freeze({
        role: canUseOperation(context, OP_ACCESS_ROLES_MANAGE),
        override: canUseOperation(context, OP_ACCESS_OVERRIDES_MANAGE),
        scope: canUseOperation(context, OP_ACCESS_SCOPES_MANAGE),
        owner: canTransferOwner && owner !== undefined,
      }),
    [canTransferOwner, context, owner]
  );
  const begin = useCallback(
    (next: AccessEditor) => {
      if (mutationPending) return;
      approvalVersion.current += 1;
      setEditor(next);
      setApproval({ request: '', busy: false });
      setIdentity(dependencies.createIdentity());
      setReceipt(undefined);
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
  const change = editor === undefined ? undefined : buildAccessChange(editor, ownerTargets);
  const validation = validateAccessChange(editor, change, context.session.assurance.level);
  const prepare = useCallback(async () => {
    if (change === undefined || mutation.isPending || approval.busy) return;
    const bodyError = validateAccessBody(editor, change);
    if (bodyError !== undefined) {
      setApproval({ request: '', busy: false, error: bodyError });
      return;
    }
    const version = approvalVersion.current;
    setApproval({ request: '', busy: true });
    try {
      const request = await dependencies.prepare.execute(change, context.session.membership, context.scope.id);
      if (approvalVersion.current === version) setApproval({ request, busy: false });
    } catch (cause) {
      if (approvalVersion.current === version) setApproval({ request: '', busy: false, error: presentError(cause).message });
    }
  }, [approval.busy, change, context.scope.id, context.session.membership, dependencies, editor, mutation.isPending]);
  const submit = useCallback(() => {
    if (change === undefined || editor === undefined || validation !== undefined || mutation.isPending) return;
    mutation.mutate({ change, proof: editor.proof, identity });
  }, [change, editor, identity, mutation, validation]);
  const close = useCallback(() => {
    if (!mutationPending) setEditor(undefined);
  }, [mutationPending]);
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

  const actions = useMemo(
    () =>
      Object.freeze({
        refresh,
        next,
        first,
        close,
        prepare: () => {
          void prepare();
        },
        submit,
        stepup: requestStepup,
        role: (membership: AccessMembership, role: AccessRole) => begin({ kind: 'role', membership, role, name: role.name, allows: role.allows, denies: role.denies, proof: '', confirmed: false }),
        override: (membership: AccessMembership) =>
          begin({ kind: 'override', membership, action: 'set', permission: membership.overrides[0]?.permission ?? permissions[0] ?? '', effect: 'allow', expiresAt: '', reason: '', proof: '', confirmed: false }),
        scope: (membership: AccessMembership) => begin({ kind: 'scope', membership, scopeKind: context.scope.kind, resource: context.scope.id, effect: 'allow', expiresAt: '', proof: '', confirmed: false }),
        owner: () => {
          if (owner) begin({ kind: 'owner', membership: owner, targetId: ownerTargets[0]?.id ?? '', reason: '', proof: '', confirmed: false });
        },
        name: (name: string) => update((current) => (current.kind === 'role' ? { ...current, name, proof: '', confirmed: false } : current)),
        permissionRule: (permission: string, rule: 'allow' | 'deny' | 'inherit') =>
          update((current) =>
            current.kind === 'role' ? { ...current, allows: selectPermission(current.allows, permission, rule === 'allow'), denies: selectPermission(current.denies, permission, rule === 'deny'), proof: '', confirmed: false } : current
          ),
        overrideAction: (action: 'set' | 'revoke') => update((current) => (current.kind === 'override' ? { ...current, action, proof: '', confirmed: false } : current)),
        permission: (permission: string) => update((current) => (current.kind === 'override' ? { ...current, permission, proof: '', confirmed: false } : current)),
        effect: (effect: AccessEffect) => update((current) => (current.kind === 'override' || current.kind === 'scope' ? { ...current, effect, proof: '', confirmed: false } : current)),
        expiresAt: (expiresAt: string) => update((current) => (current.kind === 'override' || current.kind === 'scope' ? { ...current, expiresAt, proof: '', confirmed: false } : current)),
        reason: (reason: string) => update((current) => (current.kind === 'override' || current.kind === 'owner' ? { ...current, reason, proof: '', confirmed: false } : current)),
        scopeKind: (scopeKind: AccessScopeKind) => update((current) => (current.kind === 'scope' ? { ...current, scopeKind, proof: '', confirmed: false } : current)),
        resource: (resource: string) => update((current) => (current.kind === 'scope' ? { ...current, resource, proof: '', confirmed: false } : current)),
        target: (targetId: string) => update((current) => (current.kind === 'owner' ? { ...current, targetId, proof: '', confirmed: false } : current)),
        proof: (proof: string) => update((current) => ({ ...current, proof: proof.trim() }), true),
        confirmed: (confirmed: boolean) => update((current) => ({ ...current, confirmed }), true),
        dismissReceipt: () => setReceipt(undefined),
      }),
    [begin, close, context.scope.id, context.scope.kind, first, next, owner, ownerTargets, permissions, prepare, refresh, requestStepup, submit, update]
  );

  return Object.freeze({
    page,
    cursor,
    permissions,
    ownerTargets,
    capabilities,
    editor,
    approval,
    receipt,
    validation,
    condition: queryCondition({ pending: query.isPending, fetching: query.isFetching, error: query.error, hasData: page !== undefined, empty: page?.items.length === 0 }),
    error: safeQueryError(query.error),
    fetching: query.isFetching,
    stepupRequired: hasFailureCode(query.error, 'STEPUP_REQUIRED'),
    mutation: Object.freeze({ busy: mutation.isPending, error: safeQueryError(mutation.error) }),
    actions,
  });
}

function accessQueryKey(context: ConsoleContext, cursor?: string) {
  return Object.freeze(['console', context.scope.kind, context.scope.id, context.session.accessVersion, OP_ACCESS_CENTER_READ, cursor ?? null, 50] as const);
}

function currentMembership(context: ConsoleContext): AccessMembership {
  return Object.freeze({
    id: context.session.membership,
    displayName: context.profile.display_name,
    employeeNo: context.profile.employee_no,
    mobileMasked: context.session.security.phoneMasked,
    client: 'console',
    status: 'active',
    accessVersion: context.session.accessVersion,
    roles: Object.freeze([]),
    scopes: Object.freeze([]),
    overrides: Object.freeze([]),
  });
}

export type AccessViewModel = ReturnType<typeof useAccessViewModel>;
