import type { ConsoleContext } from '../../../../entity/session/ConsoleSession';
import type { AccessEffect, AccessMembership, AccessOverrideAction, AccessPage, AccessRole, AccessScopeKind, FormerOwnerMode, Ownership, RoleTemplateCode } from '../model/Access';
import { selectPermission, type AccessEditor } from '../model/AccessEditor';
import { emptyRole, loadRoleDraft, resetOwnerPreview, type AccessTask } from './AccessViewState';

interface AccessActionInput {
  readonly scope: ConsoleContext['scope'];
  readonly createIdentity: () => string;
  readonly page: AccessPage | undefined;
  readonly ownership: Ownership | undefined;
  readonly permissions: readonly string[];
  readonly scopes: readonly Readonly<{ id: string; kind: AccessScopeKind }>[];
  readonly begin: (editor: AccessEditor) => void;
  readonly update: (transform: (current: AccessEditor) => AccessEditor, proofOnly?: boolean) => void;
  readonly refresh: () => void;
  readonly refreshScopes: () => void;
  readonly next: (cursor: string) => void;
  readonly first: () => void;
  readonly close: () => void;
  readonly resolveConflict: () => void;
  readonly prepare: () => void;
  readonly submit: () => void;
  readonly requestStepup: () => void;
  readonly setSearch: (update: (current: URLSearchParams) => URLSearchParams) => void;
  readonly dismissReceipt: () => void;
}

export function accessActions(input: AccessActionInput) {
  const beginOwner = (action: 'create' | 'accept' | 'cancel') => {
    if (input.ownership === undefined) return;
    const role = input.ownership.formerOwnerRoles[0]?.id ?? '';
    input.begin({
      kind: 'owner',
      action,
      ownership: input.ownership,
      transfer: action === 'create' ? null : input.ownership.pending,
      targetId: action === 'create' ? input.ownership.candidates.find((candidate) => candidate.mobileReady)?.membership ?? '' : input.ownership.pending?.targetMembership ?? '',
      formerOwnerMode: role ? 'retain_admin' : 'remove_admin',
      formerOwnerRole: role,
      reason: '',
      proof: '',
      confirmed: false,
    });
  };
  const beginRole = (role?: AccessRole) => {
    const restored = role === undefined ? loadRoleDraft(input.scope.id) : undefined;
    const template = input.page?.templates.find((item) => item.code === restored?.template) ?? input.page?.templates[0];
    const target = role ?? emptyRole(input.createIdentity());
    input.begin({
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
  };
  return Object.freeze({
    refresh: input.refresh,
    refreshScopes: input.refreshScopes,
    next: input.next,
    first: input.first,
    close: input.close,
    resolveConflict: input.resolveConflict,
    prepare: input.prepare,
    submit: input.submit,
    stepup: input.requestStepup,
    task: (value: AccessTask) => input.setSearch((current) => {
      const next = new URLSearchParams(current);
      if (value === 'members') next.delete('task'); else next.set('task', value);
      next.delete('cursor');
      return next;
    }),
    createRole: () => beginRole(),
    role: beginRole,
    roleStatus: (role: AccessRole) => input.begin({ kind: 'role', action: 'status', role, status: role.status === 'active' ? 'disabled' : 'active', proof: '', confirmed: false }),
    roleAssign: (role: AccessRole, membership: AccessMembership) => input.begin({ kind: 'role', action: 'assign', role, membership, proof: '', confirmed: false }),
    roleRevoke: (role: AccessRole, membership: AccessMembership) => input.begin({ kind: 'role', action: 'revoke', role, membership, proof: '', confirmed: false }),
    roleDelete: (role: AccessRole) => input.begin({ kind: 'role', action: 'delete', role, proof: '', confirmed: false }),
    override: (membership: AccessMembership) =>
      input.begin({ kind: 'override', membership, action: 'set', permission: membership.overrides[0]?.permission ?? input.permissions[0] ?? '', effect: 'allow', expiresAt: '', reason: '', proof: '', confirmed: false }),
    scope: (membership: AccessMembership) => input.begin({ kind: 'scope', membership, scopeKind: input.scope.kind, resource: input.scope.id, effect: 'allow', expiresAt: '', proof: '', confirmed: false }),
    owner: () => beginOwner('create'),
    ownerAccept: () => beginOwner('accept'),
    ownerCancel: () => beginOwner('cancel'),
    name: (name: string) => input.update((current) => (current.kind === 'role' && current.action === 'save' ? { ...current, name, proof: '', confirmed: false } : current)),
    description: (description: string) => input.update((current) => (current.kind === 'role' && current.action === 'save' ? { ...current, description, proof: '', confirmed: false } : current)),
    roleStep: (step: 1 | 2 | 3) => input.update((current) => (current.kind === 'role' && current.action === 'save' ? { ...current, step, proof: '', confirmed: false } : current)),
    roleTemplate: (template: RoleTemplateCode) => input.update((current) => {
      if (current.kind !== 'role' || current.action !== 'save') return current;
      const selected = input.page?.templates.find((item) => item.code === template);
      return { ...current, template, allows: selected?.allows ?? [], denies: selected?.denies ?? [], proof: '', confirmed: false };
    }),
    permissionRule: (permission: string, rule: 'allow' | 'deny' | 'inherit') => input.update((current) =>
      current.kind === 'role' && current.action === 'save' ? { ...current, allows: selectPermission(current.allows, permission, rule === 'allow'), denies: selectPermission(current.denies, permission, rule === 'deny'), proof: '', confirmed: false } : current
    ),
    overrideAction: (action: AccessOverrideAction) => input.update((current) => (current.kind === 'override' ? { ...current, action, proof: '', confirmed: false } : current)),
    permission: (permission: string) => input.update((current) => (current.kind === 'override' ? { ...current, permission, proof: '', confirmed: false } : current)),
    effect: (effect: AccessEffect) => input.update((current) => (current.kind === 'override' || current.kind === 'scope' ? { ...current, effect, proof: '', confirmed: false } : current)),
    expiresAt: (expiresAt: string) => input.update((current) => (current.kind === 'override' || current.kind === 'scope' ? { ...current, expiresAt, proof: '', confirmed: false } : current)),
    reason: (reason: string) => input.update((current) => (current.kind === 'override' ? { ...current, reason, proof: '', confirmed: false } : current.kind === 'owner' ? resetOwnerPreview({ ...current, reason, proof: '', confirmed: false }) : current)),
    scopeKind: (scopeKind: AccessScopeKind) => input.update((current) => (current.kind === 'scope' ? { ...current, scopeKind, resource: input.scopes.find((scope) => scope.kind === scopeKind)?.id ?? '', proof: '', confirmed: false } : current)),
    resource: (resource: string) => input.update((current) => (current.kind === 'scope' ? { ...current, resource, proof: '', confirmed: false } : current)),
    target: (targetId: string) => input.update((current) => (current.kind === 'owner' ? resetOwnerPreview({ ...current, targetId, proof: '', confirmed: false }) : current)),
    formerOwnerMode: (formerOwnerMode: FormerOwnerMode) => input.update((current) => current.kind === 'owner'
      ? resetOwnerPreview({ ...current, formerOwnerMode, formerOwnerRole: formerOwnerMode === 'retain_admin' ? current.formerOwnerRole || current.ownership.formerOwnerRoles[0]?.id || '' : '', proof: '', confirmed: false })
      : current),
    formerOwnerRole: (formerOwnerRole: string) => input.update((current) => (current.kind === 'owner' ? resetOwnerPreview({ ...current, formerOwnerRole, proof: '', confirmed: false }) : current)),
    proof: (proof: string) => input.update((current) => ({ ...current, proof: proof.trim() }), true),
    confirmed: (confirmed: boolean) => input.update((current) => ({ ...current, confirmed }), true),
    dismissReceipt: input.dismissReceipt,
  });
}
