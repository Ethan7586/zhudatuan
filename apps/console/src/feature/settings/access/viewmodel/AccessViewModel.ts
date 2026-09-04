import {
  OP_ACCESS_CENTER_READ,
  OP_ACCESS_OVERRIDES_MANAGE,
  OP_ACCESS_OWNERSHIP_READ,
  OP_ACCESS_OWNERSHIP_TRANSFERS_ACCEPT,
  OP_ACCESS_OWNERSHIP_TRANSFERS_ACCEPT_PREVIEW,
  OP_ACCESS_OWNERSHIP_TRANSFERS_CANCEL,
  OP_ACCESS_OWNERSHIP_TRANSFERS_CANCEL_PREVIEW,
  OP_ACCESS_OWNERSHIP_TRANSFERS_CREATE,
  OP_ACCESS_OWNERSHIP_TRANSFERS_PREVIEW,
  OP_ACCESS_ROLES_MANAGE,
  OP_ACCESS_SCOPES_MANAGE,
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
import type { AccessEffect, AccessMembership, AccessOverrideAction, AccessReceipt, AccessRole, AccessScopeKind, FormerOwnerMode, OwnershipPreview, RoleTemplateCode } from '../model/Access';
import { buildAccessChange, selectPermission, validateAccessBody, validateAccessChange, type AccessEditor } from '../model/AccessEditor';
import { accessConflict, type AccessConflict } from '../model/AccessConflict';
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
export type AccessTask = 'members' | 'roles' | 'scopes' | 'ownership';

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
  const [approval, setApproval] = useState<ApprovalState>({ request: '', busy: false });
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
  const pending = ownership?.pending ?? null;
  const [clock, setClock] = useState(() => Date.now());
  useEffect(() => {
    if (pending?.state !== 'pending') return;
    setClock(Date.now());
    const timer = window.setInterval(() => setClock(Date.now()), 30_000);
    return () => window.clearInterval(timer);
  }, [pending?.id, pending?.state]);
  const coolingRemaining = pending === null ? 0 : Math.max(0, new Date(pending.coolingUntil).getTime() - clock);
  const pendingActive = pending?.state === 'pending' && new Date(pending.expiresAt).getTime() > clock;
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
  const capabilities = useMemo(
    () =>
      Object.freeze({
        role: canUseOperation(context, OP_ACCESS_ROLES_MANAGE),
        override: canUseOperation(context, OP_ACCESS_OVERRIDES_MANAGE),
        scope: canReadScopes && canUseOperation(context, OP_ACCESS_SCOPES_MANAGE),
        owner:
          ownership !== undefined &&
          ownership.mobileReady &&
          ownership.candidates.some((candidate) => candidate.mobileReady) &&
          pending === null &&
          ownership.owner.membership === context.session.membership &&
          canUseOperation(context, OP_ACCESS_OWNERSHIP_TRANSFERS_PREVIEW) &&
          canUseOperation(context, OP_ACCESS_OWNERSHIP_TRANSFERS_CREATE),
        ownerAccept:
          ownership !== undefined &&
          pendingActive && coolingRemaining === 0 &&
          pending?.targetMembership === context.session.membership &&
          canUseOperation(context, OP_ACCESS_OWNERSHIP_TRANSFERS_ACCEPT_PREVIEW) &&
          canUseOperation(context, OP_ACCESS_OWNERSHIP_TRANSFERS_ACCEPT),
        ownerCancel:
          ownership !== undefined &&
          pendingActive && pending?.sourceMembership === context.session.membership &&
          canUseOperation(context, OP_ACCESS_OWNERSHIP_TRANSFERS_CANCEL_PREVIEW) &&
          canUseOperation(context, OP_ACCESS_OWNERSHIP_TRANSFERS_CANCEL),
      }),
    [canReadScopes, context, coolingRemaining, ownership, pending, pendingActive]
  );
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
  const beginOwner = useCallback(
    (action: 'create' | 'accept' | 'cancel') => {
      if (ownership === undefined) return;
      const role = ownership.formerOwnerRoles[0]?.id ?? '';
      begin({
        kind: 'owner',
        action,
        ownership,
        transfer: action === 'create' ? null : ownership.pending,
        targetId: action === 'create' ? ownership.candidates.find((candidate) => candidate.mobileReady)?.membership ?? '' : ownership.pending?.targetMembership ?? '',
        formerOwnerMode: role ? 'retain_admin' : 'remove_admin',
        formerOwnerRole: role,
        reason: '',
        proof: '',
        confirmed: false,
      });
    },
    [begin, ownership]
  );
  const beginRole = useCallback(
    (role?: AccessRole) => {
      const restored = role === undefined ? loadRoleDraft(context.scope.id) : undefined;
      const template = page?.templates.find((item) => item.code === restored?.template) ?? page?.templates[0];
      const target = role ?? emptyRole(dependencies.createIdentity());
      begin({
        kind: 'role',
        action: 'save',
        role: target,
        name: restored?.name ?? target.name,
        description: restored?.description ?? target.description,
        template: restored?.template ?? target.template ?? template?.code ?? 'custom',
        allows: restored?.allows ?? (role ? role.allows : template?.allows ?? []),
        denies: restored?.denies ?? (role ? role.denies : template?.denies ?? []),
        step: restored?.step ?? (role ? 2 : 1),
        proof: '',
        confirmed: false,
      });
    },
    [begin, context.scope.id, dependencies, page?.templates]
  );

  const actions = useMemo(
    () =>
      Object.freeze({
        refresh,
        refreshScopes: () => void refetchScopes(),
        next,
        first,
        close,
        resolveConflict,
        prepare: () => void prepare(),
        submit,
        stepup: requestStepup,
        task: (value: AccessTask) => setSearch((current) => {
          const nextSearch = new URLSearchParams(current);
          if (value === 'members') nextSearch.delete('task'); else nextSearch.set('task', value);
          nextSearch.delete('cursor');
          return nextSearch;
        }),
        createRole: () => beginRole(),
        role: (role: AccessRole) => beginRole(role),
        roleStatus: (role: AccessRole) => begin({ kind: 'role', action: 'status', role, status: role.status === 'active' ? 'disabled' : 'active', proof: '', confirmed: false }),
        roleAssign: (role: AccessRole, membership: AccessMembership) => begin({ kind: 'role', action: 'assign', role, membership, proof: '', confirmed: false }),
        roleRevoke: (role: AccessRole, membership: AccessMembership) => begin({ kind: 'role', action: 'revoke', role, membership, proof: '', confirmed: false }),
        roleDelete: (role: AccessRole) => begin({ kind: 'role', action: 'delete', role, proof: '', confirmed: false }),
        override: (membership: AccessMembership) =>
          begin({ kind: 'override', membership, action: 'set', permission: membership.overrides[0]?.permission ?? permissions[0] ?? '', effect: 'allow', expiresAt: '', reason: '', proof: '', confirmed: false }),
        scope: (membership: AccessMembership) => begin({ kind: 'scope', membership, scopeKind: context.scope.kind, resource: context.scope.id, effect: 'allow', expiresAt: '', proof: '', confirmed: false }),
        owner: () => beginOwner('create'),
        ownerAccept: () => beginOwner('accept'),
        ownerCancel: () => beginOwner('cancel'),
        name: (name: string) => update((current) => (current.kind === 'role' && current.action === 'save' ? { ...current, name, proof: '', confirmed: false } : current)),
        description: (description: string) => update((current) => (current.kind === 'role' && current.action === 'save' ? { ...current, description, proof: '', confirmed: false } : current)),
        roleStep: (step: 1 | 2 | 3) => update((current) => (current.kind === 'role' && current.action === 'save' ? { ...current, step, proof: '', confirmed: false } : current)),
        roleTemplate: (template: RoleTemplateCode) => update((current) => {
          if (current.kind !== 'role' || current.action !== 'save') return current;
          const selected = page?.templates.find((item) => item.code === template);
          return { ...current, template, allows: selected?.allows ?? [], denies: selected?.denies ?? [], proof: '', confirmed: false };
        }),
        permissionRule: (permission: string, rule: 'allow' | 'deny' | 'inherit') =>
          update((current) =>
            current.kind === 'role' && current.action === 'save' ? { ...current, allows: selectPermission(current.allows, permission, rule === 'allow'), denies: selectPermission(current.denies, permission, rule === 'deny'), proof: '', confirmed: false } : current
          ),
        overrideAction: (action: AccessOverrideAction) => update((current) => (current.kind === 'override' ? { ...current, action, proof: '', confirmed: false } : current)),
        permission: (permission: string) => update((current) => (current.kind === 'override' ? { ...current, permission, proof: '', confirmed: false } : current)),
        effect: (effect: AccessEffect) => update((current) => (current.kind === 'override' || current.kind === 'scope' ? { ...current, effect, proof: '', confirmed: false } : current)),
        expiresAt: (expiresAt: string) => update((current) => (current.kind === 'override' || current.kind === 'scope' ? { ...current, expiresAt, proof: '', confirmed: false } : current)),
        reason: (reason: string) => update((current) => (current.kind === 'override' ? { ...current, reason, proof: '', confirmed: false } : current.kind === 'owner' ? resetOwnerPreview({ ...current, reason, proof: '', confirmed: false }) : current)),
        scopeKind: (scopeKind: AccessScopeKind) => update((current) => (current.kind === 'scope' ? { ...current, scopeKind, resource: scopes.find((scope) => scope.kind === scopeKind)?.id ?? '', proof: '', confirmed: false } : current)),
        resource: (resource: string) => update((current) => (current.kind === 'scope' ? { ...current, resource, proof: '', confirmed: false } : current)),
        target: (targetId: string) => update((current) => (current.kind === 'owner' ? resetOwnerPreview({ ...current, targetId, proof: '', confirmed: false }) : current)),
        formerOwnerMode: (formerOwnerMode: FormerOwnerMode) =>
          update((current) =>
            current.kind === 'owner'
              ? resetOwnerPreview({ ...current, formerOwnerMode, formerOwnerRole: formerOwnerMode === 'retain_admin' ? current.formerOwnerRole || current.ownership.formerOwnerRoles[0]?.id || '' : '', proof: '', confirmed: false })
              : current
          ),
        formerOwnerRole: (formerOwnerRole: string) => update((current) => (current.kind === 'owner' ? resetOwnerPreview({ ...current, formerOwnerRole, proof: '', confirmed: false }) : current)),
        proof: (proof: string) => update((current) => ({ ...current, proof: proof.trim() }), true),
        confirmed: (confirmed: boolean) => update((current) => ({ ...current, confirmed }), true),
        dismissReceipt: () => setReceipt(undefined),
      }),
    [begin, beginOwner, beginRole, close, context.scope.id, context.scope.kind, first, next, page?.templates, permissions, prepare, refresh, refetchScopes, requestStepup, resolveConflict, scopes, setSearch, submit, update]
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

interface StoredRoleDraft {
  readonly name: string;
  readonly description: string;
  readonly template: RoleTemplateCode;
  readonly allows: readonly string[];
  readonly denies: readonly string[];
  readonly step: 1 | 2 | 3;
}

function emptyRole(id: string): AccessRole {
  return Object.freeze({ id: `role:${id}`, name: '', description: '', status: 'active', kind: 'custom', template: null, version: 0, allows: Object.freeze([]), denies: Object.freeze([]), affectedPeople: 0, affectedScopes: 0, members: Object.freeze([]) });
}

function roleDraftKey(scope: string): string {
  return `zhudatuan:access:roledraft:${scope}`;
}

function saveRoleDraft(scope: string, editor: Extract<AccessEditor, { kind: 'role'; action: 'save' }>): void {
  try {
    const draft: StoredRoleDraft = { name: editor.name, description: editor.description, template: editor.template, allows: editor.allows, denies: editor.denies, step: editor.step };
    window.localStorage.setItem(roleDraftKey(scope), JSON.stringify(draft));
  } catch {
    // Storage denial must not block the formal server-side save path.
  }
}

function loadRoleDraft(scope: string): StoredRoleDraft | undefined {
  try {
    const raw = window.localStorage.getItem(roleDraftKey(scope));
    if (!raw) return undefined;
    const value = JSON.parse(raw) as Partial<StoredRoleDraft>;
    const templates: readonly string[] = ['malloperator', 'catalogoperator', 'ordersupport', 'financeoperator', 'financereviewer', 'administrator', 'custom'];
    if (typeof value.name !== 'string' || typeof value.description !== 'string' || !templates.includes(value.template ?? '') || !Array.isArray(value.allows) || !Array.isArray(value.denies) || (value.step !== 1 && value.step !== 2 && value.step !== 3)) return undefined;
    return value as StoredRoleDraft;
  } catch {
    return undefined;
  }
}

function clearRoleDraft(scope: string): void {
  try {
    window.localStorage.removeItem(roleDraftKey(scope));
  } catch {
    // A completed authoritative write remains successful even if local cleanup is denied.
  }
}

function accessQueryKey(context: ConsoleContext, cursor?: string) {
  return Object.freeze(['console', context.scope.kind, context.scope.id, context.session.accessVersion, OP_ACCESS_CENTER_READ, cursor ?? null, 50] as const);
}

function ownershipQueryKey(context: ConsoleContext) {
  return Object.freeze(['console', context.scope.kind, context.scope.id, context.session.accessVersion, OP_ACCESS_OWNERSHIP_READ] as const);
}

function scopeQueryKey(context: ConsoleContext) {
  return Object.freeze(['console', context.scope.kind, context.scope.id, context.session.accessVersion, OP_ORGANIZATION_LAYERS_READ, 'access'] as const);
}

function resetOwnerPreview(editor: Extract<AccessEditor, { kind: 'owner' }>): Extract<AccessEditor, { kind: 'owner' }> {
  const next = { ...editor };
  Reflect.deleteProperty(next, 'preview');
  return next;
}

export type AccessViewModel = ReturnType<typeof useAccessViewModel>;
