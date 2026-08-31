import type { OperationDatabase } from '../../../../foundation/application/ModuleOperations';
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

export interface AccessRepository {
  center(database: OperationDatabase, input: Readonly<{ organization: string; after: string | null; limit: number }>): Promise<readonly AccessCenterRecord[]>;
  lockRole(database: OperationDatabase, role: string, scope: string): Promise<Role | null>;
  saveRole(database: OperationDatabase, input: Readonly<{ role: string; scope: string; name: string; allows: readonly string[]; denies: readonly string[]; expectedVersion: number }>): Promise<RoleChange | null>;
  scopePath(database: OperationDatabase, scope: string, kind: string): Promise<string | null>;
  grantScope(database: OperationDatabase, input: Readonly<{ id: string; membership: string; kind: string; scope: string; path: string; effect: PermissionEffect; expiresAt: Date | null; expectedVersion: number }>): Promise<Scope | null>;
  lockOverrideTarget(database: OperationDatabase, membership: string): Promise<OverrideTarget | null>;
  setOverride(database: OperationDatabase, value: Override, issuer: string): Promise<OverrideChange | null>;
  revokeOverride(database: OperationDatabase, input: Readonly<{ membership: string; permission: string; reason: string }>): Promise<OverrideChange | null>;
  lockOwnership(database: OperationDatabase, scope: string): Promise<Ownership | null>;
  lockMemberships(database: OperationDatabase, memberships: readonly string[]): Promise<readonly Membership[]>;
  expireRole(database: OperationDatabase, membership: string, role: string): Promise<boolean>;
  assignRole(database: OperationDatabase, input: Readonly<{ membership: string; role: string; issuer: string }>): Promise<void>;
  transferOwnership(database: OperationDatabase, input: Readonly<{ scope: string; membership: string; expectedVersion: number }>): Promise<boolean>;
  ownerTransferred(database: OperationDatabase, input: Readonly<{ scope: string; previous: string; membership: string; version: number; trace: string }>): Promise<void>;
  incrementVersion(database: OperationDatabase, membership: string): Promise<VersionChange | null>;
  incrementRoleVersions(database: OperationDatabase, role: string): Promise<readonly VersionChange[]>;
  activate(database: OperationDatabase, membership: string): Promise<VersionChange | null>;
  versionChanged(database: OperationDatabase, changes: readonly VersionChange[], reason: string, trace: string): Promise<void>;
  membershipActivated(database: OperationDatabase, input: Readonly<{ change: VersionChange; invitation: string; target: 'storefront'; grantDigest: string; trace: string }>): Promise<void>;
  createCampaignMembership(
    database: OperationDatabase,
    input: Readonly<{ membership: string; member: string; principal: string; organization: string; issuer: string; mallGrant: string; ownerGrant: string; selfGrant: string }>
  ): Promise<void>;
  pendingMember(database: OperationDatabase, membership: string): Promise<string | null>;
  lockDelegationIssuer(database: OperationDatabase, membership: string): Promise<DelegationIssuer | null>;
  delegationTarget(database: OperationDatabase, membership: string): Promise<DelegationTarget | null>;
  delegationPermissions(database: OperationDatabase, roles: readonly string[]): Promise<readonly DelegationPermission[]>;
  delegationScopes(database: OperationDatabase, membership: string): Promise<readonly DelegationScope[]>;
  campaignRoles(database: OperationDatabase): Promise<readonly DelegationRole[]>;
  delegationRoles(database: OperationDatabase, membership: string): Promise<readonly DelegationRole[]>;
  activeMemberships(database: OperationDatabase, member: string, target: 'console' | 'storefront'): Promise<readonly ActiveMembershipReference[]>;
  lockSession(database: OperationDatabase, membership: string, target: 'console' | 'storefront'): Promise<number | null>;
  directoryMemberships(database: OperationDatabase, memberships: readonly string[]): Promise<readonly DirectoryMembershipReference[]>;
  ensureImported(database: OperationDatabase, input: Readonly<{ membership: string; member: string; principal: string; organization: string; client: 'operator' | 'storefront'; employee: string | null }>): Promise<void>;
  activeMember(database: OperationDatabase, membership: string): Promise<string | null>;
  activeMemberIn(database: OperationDatabase, member: string, organizations: readonly string[]): Promise<boolean>;
  memberPage(database: OperationDatabase, organization: string, after: string | null, limit: number): Promise<readonly MemberRecord[]>;
  memberProfile(database: OperationDatabase, membership: string): Promise<MemberRecord | null>;
  setEmployeeNumber(database: OperationDatabase, membership: string, employee: string | null): Promise<boolean>;
  managementMember(database: OperationDatabase, membership: string): Promise<Readonly<{ member: string; accessVersion: number }> | null>;
  setMembershipStatus(database: OperationDatabase, membership: string, status: 'active' | 'suspended' | 'left'): Promise<boolean>;
  replaceDepartment(database: OperationDatabase, input: Readonly<{ membership: string; department: string; path: string; grant: string }>): Promise<void>;
  applyDirectoryState(database: OperationDatabase, input: Readonly<{ membership: string; status: 'active' | 'suspended' | 'left' }>): Promise<number | null>;
  replaceDirectoryDepartment(database: OperationDatabase, input: Readonly<{ membership: string; department: string; grant: string; accessVersion: number }>): Promise<void>;
}
