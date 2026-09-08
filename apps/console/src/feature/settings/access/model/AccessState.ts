import type { OperationBodyFor, OperationId, OperationOutputFor, OperationTarget } from '@shop/contract';
import type { OwnerChange } from './OwnershipState';
export type { FormerOwnerMode, FormerOwnerRole, OwnerCandidate, OwnerChange, OwnerIdentity, Ownership, OwnershipImpact, OwnershipPreview, OwnershipTransfer, OwnershipTransferState } from './OwnershipState';

type AccessCenterDto = OperationOutputFor<'access.center.read'>;
type AccessScopeDto = AccessCenterDto['items'][number]['scopes'][number];
type AccessRoleDto = AccessCenterDto['roles'][number];
type AccessMembershipDto = AccessCenterDto['items'][number];
type AccessRoleBody = OperationBodyFor<'AccessRolesManageInput'>;
export type AccessEffect = AccessScopeDto['effect'];
export type AccessScopeKind = AccessScopeDto['kind'];
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
