import type { ReadTransactionContext, WriteTransactionContext } from '../../../../foundation/persistence/TransactionContext';

import type { Membership } from '../../domain/model/Membership';
import type { Override } from '../../domain/model/Override';
import type { PermissionEffect, Role } from '../../domain/model/Role';
import type { Scope } from '../../domain/model/Scope';

export interface AccessCenterRecord {
  readonly id: string;
  readonly client: 'console' | 'storefront';
  readonly status: string;
  readonly accessVersion: number;
  readonly roles: readonly Readonly<{ role: string; name: string; kind: 'custom' | 'system' | 'owner'; version: number; allows: readonly string[]; denies: readonly string[] }>[];
  readonly scopes: readonly Readonly<{ id: string; kind: string; scope: string; effect: PermissionEffect; expires: string | null }>[];
  readonly overrides: readonly Readonly<{ permission: string; effect: PermissionEffect; expires: string | null }>[];
}
export interface RoleChange {
  readonly role: Role;
  readonly allowCount: number;
  readonly denyCount: number;
}
export interface OverrideTarget {
  readonly membership: Membership;
  readonly owner: boolean;
}
export interface OverrideChange {
  readonly effect: PermissionEffect;
  readonly expiresAt: Date | null;
}
export interface Ownership {
  readonly scope: string;
  readonly role: string;
  readonly membership: string;
  readonly version: number;
  readonly roleKind: string;
}
export interface VersionChange {
  readonly membership: string;
  readonly organization: string;
  readonly version: number;
}
export interface DelegationIssuer {
  readonly organization: string;
  readonly accessVersion: number;
}
export interface DelegationTarget {
  readonly id: string;
  readonly organization: string;
  readonly principal: string | null;
  readonly status: string;
  readonly client: string;
}
export interface DelegationRole {
  readonly id: string;
  readonly version: number;
  readonly kind: 'custom' | 'system' | 'owner';
  readonly expiresAt: Date | null;
}
export interface DelegationPermission {
  readonly role: string;
  readonly roleVersion: number;
  readonly code: string;
  readonly effect: PermissionEffect;
}
export interface DelegationScope {
  readonly id: string;
  readonly kind: string;
  readonly scope: string;
  readonly path: string;
  readonly effect: PermissionEffect;
  readonly accessVersion: number;
  readonly effectiveAt: Date;
  readonly expiresAt: Date | null;
}
export interface MembershipReference {
  readonly id: string;
  readonly client: 'console' | 'storefront';
}
export interface ActiveMembershipReference extends MembershipReference {
  readonly organization: string;
  readonly accessVersion: number;
}
export interface DirectoryMembershipReference extends MembershipReference {
  readonly principal: string;
}
export interface MemberRecord {
  readonly id: string;
  readonly member: string;
  readonly organization: string;
  readonly employee: string | null;
  readonly status: string;
  readonly accessVersion: number;
  readonly joinedAt: Date | null;
}
export interface PendingEmployeeRecord {
  readonly member: string;
  readonly organization: string;
  readonly employeeNo: string | null;
  readonly department: string | null;
}

export interface AccessRepository {
  center(context: ReadTransactionContext, input: Readonly<{ organization: string; after: string | null; limit: number }>): Promise<readonly AccessCenterRecord[]>;
  lockRole(context: WriteTransactionContext, role: string, scope: string): Promise<Role | null>;
  saveRole(context: WriteTransactionContext, input: Readonly<{ role: string; scope: string; name: string; allows: readonly string[]; denies: readonly string[]; expectedVersion: number }>): Promise<RoleChange | null>;
  scopePath(context: ReadTransactionContext, scope: string, kind: string): Promise<string | null>;
  grantScope(
    context: WriteTransactionContext,
    input: Readonly<{ id: string; membership: string; kind: string; scope: string; path: string; effect: PermissionEffect; expiresAt: Date | null; expectedVersion: number }>
  ): Promise<Scope | null>;
  lockOverrideTarget(context: WriteTransactionContext, membership: string): Promise<OverrideTarget | null>;
  setOverride(context: WriteTransactionContext, value: Override, issuer: string): Promise<OverrideChange | null>;
  revokeOverride(context: WriteTransactionContext, input: Readonly<{ membership: string; permission: string; reason: string }>): Promise<OverrideChange | null>;
  lockOwnership(context: WriteTransactionContext, scope: string): Promise<Ownership | null>;
  lockMemberships(context: WriteTransactionContext, memberships: readonly string[]): Promise<readonly Membership[]>;
  expireRole(context: WriteTransactionContext, membership: string, role: string): Promise<boolean>;
  assignRole(context: WriteTransactionContext, input: Readonly<{ membership: string; role: string; issuer: string }>): Promise<void>;
  transferOwnership(context: WriteTransactionContext, input: Readonly<{ scope: string; membership: string; expectedVersion: number }>): Promise<boolean>;
  ownerTransferred(context: WriteTransactionContext, input: Readonly<{ scope: string; previous: string; membership: string; version: number; trace: string }>): Promise<void>;
  incrementVersion(context: WriteTransactionContext, membership: string): Promise<VersionChange | null>;
  incrementRoleVersions(context: WriteTransactionContext, role: string): Promise<readonly VersionChange[]>;
  activate(context: WriteTransactionContext, membership: string): Promise<VersionChange | null>;
  versionChanged(context: WriteTransactionContext, changes: readonly VersionChange[], reason: string, trace: string): Promise<void>;
  membershipActivated(context: WriteTransactionContext, input: Readonly<{ change: VersionChange; invitation: string; target: 'storefront'; grantDigest: string; trace: string }>): Promise<void>;
  createStorefrontMembership(
    context: WriteTransactionContext,
    input: Readonly<{
      membership: string;
      member: string;
      principal: string;
      organization: string;
      issuer: string;
      issuerAccessVersion: number;
      employeeNo: string | null;
      department: string | null;
    }>
  ): Promise<void>;
  pendingMember(context: ReadTransactionContext, membership: string): Promise<string | null>;
  pendingEmployee(context: ReadTransactionContext, membership: string): Promise<PendingEmployeeRecord | null>;
  delegationIssuer(context: ReadTransactionContext, membership: string): Promise<DelegationIssuer | null>;
  delegationTarget(context: ReadTransactionContext, membership: string): Promise<DelegationTarget | null>;
  delegationPermissions(context: ReadTransactionContext, roles: readonly string[]): Promise<readonly DelegationPermission[]>;
  delegationScopes(context: ReadTransactionContext, membership: string): Promise<readonly DelegationScope[]>;
  campaignRoles(context: ReadTransactionContext): Promise<readonly DelegationRole[]>;
  delegationRoles(context: ReadTransactionContext, membership: string): Promise<readonly DelegationRole[]>;
  activeMemberships(context: ReadTransactionContext, member: string, target: 'console' | 'storefront'): Promise<readonly ActiveMembershipReference[]>;
  lockSession(context: WriteTransactionContext, membership: string, target: 'console' | 'storefront'): Promise<number | null>;
  directoryMemberships(context: ReadTransactionContext, memberships: readonly string[]): Promise<readonly DirectoryMembershipReference[]>;
  ensureImported(context: WriteTransactionContext, input: Readonly<{ membership: string; member: string; principal: string; organization: string; client: 'operator' | 'storefront'; employee: string | null }>): Promise<void>;
  activeMember(context: ReadTransactionContext, membership: string): Promise<string | null>;
  activeMemberIn(context: ReadTransactionContext, member: string, organizations: readonly string[]): Promise<boolean>;
  memberPage(context: ReadTransactionContext, organization: string, after: string | null, limit: number): Promise<readonly MemberRecord[]>;
  memberProfile(context: ReadTransactionContext, membership: string): Promise<MemberRecord | null>;
  setEmployeeNumber(context: WriteTransactionContext, membership: string, employee: string | null): Promise<boolean>;
  managementMember(context: WriteTransactionContext, membership: string): Promise<Readonly<{ member: string; accessVersion: number }> | null>;
  setMembershipStatus(context: WriteTransactionContext, membership: string, status: 'active' | 'suspended' | 'left'): Promise<boolean>;
  replaceDepartment(context: WriteTransactionContext, input: Readonly<{ membership: string; department: string; path: string; grant: string }>): Promise<void>;
  applyDirectoryState(context: WriteTransactionContext, input: Readonly<{ membership: string; status: 'active' | 'suspended' | 'left' }>): Promise<number | null>;
  replaceDirectoryDepartment(context: WriteTransactionContext, input: Readonly<{ membership: string; department: string; grant: string; accessVersion: number }>): Promise<void>;
}
