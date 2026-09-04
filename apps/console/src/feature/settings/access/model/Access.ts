import {
  OP_ACCESS_OVERRIDES_MANAGE,
  OP_ACCESS_OWNERSHIP_TRANSFERS_ACCEPT,
  OP_ACCESS_OWNERSHIP_TRANSFERS_ACCEPT_PREVIEW,
  OP_ACCESS_OWNERSHIP_TRANSFERS_CANCEL,
  OP_ACCESS_OWNERSHIP_TRANSFERS_CANCEL_PREVIEW,
  OP_ACCESS_OWNERSHIP_TRANSFERS_CREATE,
  OP_ACCESS_OWNERSHIP_TRANSFERS_PREVIEW,
  OP_ACCESS_ROLES_MANAGE,
  OP_ACCESS_SCOPES_MANAGE,
} from '@shop/contract/ids';
import type { OperationBodyFor, OperationId, OperationOutputFor, OperationTarget } from '@shop/contract';

type AccessCenterDto = OperationOutputFor<'access.center.read'>;
type AccessScopeDto = AccessCenterDto['items'][number]['scopes'][number];
type AccessRoleDto = AccessCenterDto['roles'][number];
type AccessMembershipDto = AccessCenterDto['items'][number];
type OwnershipTransferDto = NonNullable<OperationOutputFor<'access.ownership.read'>['pending']>;
type AccessRoleBody = OperationBodyFor<'AccessRolesManageInput'>;
export type AccessEffect = AccessScopeDto['effect'];
export type AccessScopeKind = AccessScopeDto['kind'];
export type OwnershipTransferState = OwnershipTransferDto['state'];
export type FormerOwnerMode = OwnershipTransferDto['formerOwnerMode'];
export type RoleTemplateCode = AccessCenterDto['templates'][number]['code'];
export type AccessRoleState = AccessRoleDto['status'];
export type AccessRoleMembershipAction = Extract<AccessRoleBody, { targetMembership: string }>['action'];
export type AccessOverrideAction = OperationBodyFor<'AccessOverridesManageInput'>['action'];

export interface AccessRole {
  readonly id: string;
  readonly name: string;
  readonly description: string;
  readonly status: AccessRoleDto['status'];
  readonly kind: AccessRoleDto['kind'];
  readonly template: RoleTemplateCode | null;
  readonly version: number;
  readonly allows: readonly string[];
  readonly denies: readonly string[];
  readonly affectedPeople: number;
  readonly affectedScopes: number;
  readonly members: readonly RoleMember[];
}

export interface RoleMember {
  readonly membership: string;
  readonly displayName: string;
  readonly accessVersion: number;
}

export interface RoleTemplate {
  readonly code: RoleTemplateCode;
  readonly name: string;
  readonly description: string;
  readonly allows: readonly string[];
  readonly denies: readonly string[];
  readonly version: number;
}

export interface AccessScope {
  readonly id: string;
  readonly kind: AccessScopeKind;
  readonly resource: string;
  readonly effect: AccessEffect;
  readonly expiresAt: string | null;
}

export interface AccessOverride {
  readonly permission: string;
  readonly effect: AccessEffect;
  readonly expiresAt: string | null;
}

export interface AccessMembership {
  readonly id: string;
  readonly displayName: string;
  readonly employeeNo: string | null;
  readonly mobileMasked: string | null;
  readonly client: OperationTarget;
  readonly status: AccessMembershipDto['status'];
  readonly accessVersion: number;
  readonly roles: readonly AccessRole[];
  readonly scopes: readonly AccessScope[];
  readonly overrides: readonly AccessOverride[];
}

export interface AccessPage {
  readonly items: readonly AccessMembership[];
  readonly roles: readonly AccessRole[];
  readonly templates: readonly RoleTemplate[];
  readonly separationRules: readonly Readonly<{ left: string; right: string; reason: string }>[];
  readonly count: number;
  readonly nextCursor?: string;
}

export interface OwnerIdentity {
  readonly membership: string;
  readonly member: string;
  readonly principal: string;
  readonly displayName: string;
}

export interface OwnerCandidate extends OwnerIdentity {
  readonly roles: readonly string[];
  readonly accessVersion: number;
  readonly mobileReady: boolean;
}

export interface FormerOwnerRole {
  readonly id: string;
  readonly name: string;
  readonly version: number;
}

export interface OwnershipTransfer {
  readonly id: string;
  readonly state: OwnershipTransferState;
  readonly sourceMembership: string;
  readonly targetMembership: string;
  readonly targetMember: string;
  readonly targetPrincipal: string;
  readonly targetDisplayName: string;
  readonly formerOwnerMode: FormerOwnerMode;
  readonly formerOwnerRole: string | null;
  readonly formerOwnerRoleVersion: number | null;
  readonly coolingUntil: string;
  readonly expiresAt: string;
  readonly version: number;
}

export interface Ownership {
  readonly state: OperationOutputFor<'access.ownership.read'>['state'];
  readonly version: number;
  readonly mobileReady: boolean;
  readonly owner: OwnerIdentity;
  readonly candidates: readonly OwnerCandidate[];
  readonly formerOwnerRoles: readonly FormerOwnerRole[];
  readonly pending: OwnershipTransfer | null;
}

export interface OwnershipImpact {
  readonly sourceMembership: string;
  readonly targetMembership: string;
  readonly ownershipVersion: number;
  readonly targetAccessVersion: number;
  readonly formerOwnerRoleVersion: number | null;
  readonly affectedPeople: number;
  readonly affectedScopes: number;
  readonly warnings: readonly string[];
}

export type OwnershipPreview =
  | Readonly<{ action: 'create'; state: OperationOutputFor<'access.ownership.transfers.preview'>['state']; formerOwnerMode: FormerOwnerMode; formerOwnerRole: string | null; coolingUntil: string; expiresAt: string; impact: OwnershipImpact }>
  | Readonly<{ action: 'accept' | 'cancel'; transfer: OwnershipTransfer; impact: OwnershipImpact; reason?: string }>;

export type OwnerChange =
  | Readonly<{ kind: 'owner'; action: 'create'; ownership: Ownership; target: OwnerCandidate; formerOwnerMode: FormerOwnerMode; formerOwnerRole: string | null; reason: string }>
  | Readonly<{ kind: 'owner'; action: 'accept'; ownership: Ownership; transfer: OwnershipTransfer }>
  | Readonly<{ kind: 'owner'; action: 'cancel'; ownership: Ownership; transfer: OwnershipTransfer; reason: string }>;

export type AccessChange =
  | Readonly<{ kind: 'role'; action: 'save'; role: AccessRole; name: string; description: string; template: RoleTemplateCode; allows: readonly string[]; denies: readonly string[] }>
  | Readonly<{ kind: 'role'; action: 'status'; role: AccessRole; status: AccessRoleState }>
  | Readonly<{ kind: 'role'; action: AccessRoleMembershipAction; role: AccessRole; membership: AccessMembership }>
  | Readonly<{ kind: 'role'; action: 'delete'; role: AccessRole }>
  | Readonly<{ kind: 'override'; membership: AccessMembership; action: AccessOverrideAction; permission: string; effect: AccessEffect; expiresAt?: string; reason: string }>
  | Readonly<{ kind: 'scope'; membership: AccessMembership; scopeKind: AccessScopeKind; resource: string; effect: AccessEffect; expiresAt?: string }>
  | OwnerChange;

export interface AccessEnvelope {
  readonly operation: OperationId;
  readonly input: Readonly<{ path?: Readonly<Record<string, string>>; body: Readonly<Record<string, unknown>> }>;
  readonly expectedVersion: number;
}

export interface AccessReceipt {
  readonly operation: OperationId;
  readonly reference: string;
  readonly version: number;
  readonly message: string;
}

export function accessEnvelope(change: AccessChange): AccessEnvelope {
  if (change.kind === 'role')
    return Object.freeze({
      operation: OP_ACCESS_ROLES_MANAGE,
      input: Object.freeze({
        path: Object.freeze({ roleid: change.role.id }),
        body: Object.freeze(
          change.action === 'save'
            ? { action: 'save' as const, name: change.name.trim(), description: change.description.trim(), template: change.template, allows: [...change.allows], denies: [...change.denies] }
            : change.action === 'status'
              ? { action: 'status' as const, status: change.status }
              : change.action === 'assign' || change.action === 'revoke'
                ? { action: change.action, targetMembership: change.membership.id }
                : { action: 'delete' as const }
        ),
      }),
      expectedVersion: change.action === 'assign' || change.action === 'revoke' ? change.membership.accessVersion : change.role.version,
    });
  if (change.kind === 'override') {
    const body =
      change.action === 'revoke'
        ? { action: 'revoke' as const, targetMembership: change.membership.id, permission: change.permission, reason: change.reason.trim() }
        : { action: 'set' as const, targetMembership: change.membership.id, permission: change.permission, effect: change.effect, ...(change.expiresAt ? { expiresAt: change.expiresAt } : {}), reason: change.reason.trim() };
    return Object.freeze({ operation: OP_ACCESS_OVERRIDES_MANAGE, input: Object.freeze({ body: Object.freeze(body) }), expectedVersion: change.membership.accessVersion });
  }
  if (change.kind === 'scope')
    return Object.freeze({
      operation: OP_ACCESS_SCOPES_MANAGE,
      input: Object.freeze({ body: Object.freeze({ targetMembership: change.membership.id, kind: change.scopeKind, scope: change.resource.trim(), effect: change.effect, ...(change.expiresAt ? { expiresAt: change.expiresAt } : {}) }) }),
      expectedVersion: change.membership.accessVersion,
    });
  if (change.action === 'create') {
    const body = {
      targetMembership: change.target.membership,
      targetAccessVersion: change.target.accessVersion,
      formerOwnerMode: change.formerOwnerMode,
      ...(change.formerOwnerRole === null ? {} : { formerOwnerRole: change.formerOwnerRole }),
      reason: change.reason.trim(),
    };
    return Object.freeze({ operation: OP_ACCESS_OWNERSHIP_TRANSFERS_CREATE, input: Object.freeze({ body: Object.freeze(body) }), expectedVersion: change.ownership.version });
  }
  if (change.action === 'accept') {
    return Object.freeze({
      operation: OP_ACCESS_OWNERSHIP_TRANSFERS_ACCEPT,
      input: Object.freeze({ path: Object.freeze({ transferid: change.transfer.id }), body: Object.freeze({}) }),
      expectedVersion: change.transfer.version,
    });
  }
  return Object.freeze({
    operation: OP_ACCESS_OWNERSHIP_TRANSFERS_CANCEL,
    input: Object.freeze({ path: Object.freeze({ transferid: change.transfer.id }), body: Object.freeze({ reason: change.reason.trim() }) }),
    expectedVersion: change.transfer.version,
  });
}

export function ownershipPreviewEnvelope(change: OwnerChange): AccessEnvelope {
  const envelope = accessEnvelope(change);
  if (change.action === 'create') return Object.freeze({ ...envelope, operation: OP_ACCESS_OWNERSHIP_TRANSFERS_PREVIEW });
  if (change.action === 'accept') return Object.freeze({ ...envelope, operation: OP_ACCESS_OWNERSHIP_TRANSFERS_ACCEPT_PREVIEW });
  return Object.freeze({ ...envelope, operation: OP_ACCESS_OWNERSHIP_TRANSFERS_CANCEL_PREVIEW });
}
