import type { ReadTransactionContext, WriteTransactionContext } from '../../../../foundation/persistence/TransactionContext';

import type { Membership } from '../../domain/model/Membership';
import type { Override } from '../../domain/model/Override';
import type { PermissionEffect, Role, RoleTemplateCode } from '../../domain/model/Role';
import type { Scope } from '../../domain/model/Scope';
import type { MemberProfileProjection } from '../../public/MemberAccessPort';

export interface AccessCenterRecord {
  readonly id: string;
  readonly displayName: string;
  readonly employeeNo: string | null;
  readonly mobileMasked: string | null;
  readonly client: 'console' | 'storefront' | 'miniapp' | 'store' | 'supplier';
  readonly status: string;
  readonly accessVersion: number;
  readonly roles: readonly Readonly<{ role: string; name: string; description: string; status: 'active' | 'disabled'; kind: 'custom' | 'system' | 'owner'; template: RoleTemplateCode | null; version: number; allows: readonly string[]; denies: readonly string[] }>[];
  readonly scopes: readonly Readonly<{ id: string; kind: string; scope: string; effect: PermissionEffect; expires: string | null }>[];
  readonly overrides: readonly Readonly<{ permission: string; effect: PermissionEffect; expires: string | null }>[];
}
export interface RoleChange {
  readonly role: Role;
  readonly allowCount: number;
  readonly denyCount: number;
}
export interface RolePermissionState {
  readonly allows: readonly string[];
  readonly denies: readonly string[];
}
export interface RoleImpact {
  readonly people: number;
  readonly scopes: number;
}
export interface RoleTemplate {
  readonly code: RoleTemplateCode;
  readonly name: string;
  readonly description: string;
  readonly allows: readonly string[];
  readonly denies: readonly string[];
  readonly version: number;
}
export interface RoleDirectoryRecord {
  readonly id: string;
  readonly name: string;
  readonly description: string;
  readonly status: 'active' | 'disabled';
  readonly kind: 'custom' | 'system' | 'owner';
  readonly template: RoleTemplateCode | null;
  readonly version: number;
  readonly allows: readonly string[];
  readonly denies: readonly string[];
  readonly affectedPeople: number;
  readonly affectedScopes: number;
  readonly members: readonly Readonly<{ membership: string; displayName: string; accessVersion: number }>[];
}
export interface RoleAssignmentChange {
  readonly changed: boolean;
  readonly accessVersion: number;
}
export interface SeparationRule {
  readonly left: string;
  readonly right: string;
  readonly reason: string;
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
  readonly client: 'console' | 'storefront' | 'miniapp' | 'store' | 'supplier';
}
export interface ActiveMembershipReference extends MembershipReference {
  readonly organization: string;
  readonly accessVersion: number;
  readonly displayName: string;
  readonly organizationName: string;
  readonly scopeKind: string;
  readonly scopeId: string;
  readonly roleLabel: string;
  readonly logoUrl: string | null;
}
export interface DirectoryMembershipReference extends ActiveMembershipReference {
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
  readonly registrationResetAllowed: boolean;
  readonly registrationResetBlockReason: 'self' | 'protected' | 'inactive' | null;
}
export interface PendingEmployeeRecord {
  readonly member: string;
  readonly organization: string;
  readonly employeeNo: string | null;
  readonly department: string | null;
}

export interface AccessRepository {
  center(context: ReadTransactionContext, input: Readonly<{ organization: string; after: string | null; limit: number }>): Promise<readonly AccessCenterRecord[]>;
  roles(context: ReadTransactionContext, scope: string): Promise<readonly RoleDirectoryRecord[]>;
  roleTemplates(context: ReadTransactionContext): Promise<readonly RoleTemplate[]>;
  separationRules(context: ReadTransactionContext): Promise<readonly SeparationRule[]>;
  lockRole(context: WriteTransactionContext, role: string, scope: string): Promise<Role | null>;
  rolePermissions(context: ReadTransactionContext, role: string): Promise<RolePermissionState>;
  roleImpact(context: ReadTransactionContext, role: string): Promise<RoleImpact>;
  roleTemplate(context: ReadTransactionContext, code: string): Promise<RoleTemplate | null>;
  saveRole(context: WriteTransactionContext, input: Readonly<{ role: string; scope: string; name: string; description: string; template: RoleTemplateCode | null; allows: readonly string[]; denies: readonly string[]; expectedVersion: number }>): Promise<RoleChange | null>;
  setRoleStatus(context: WriteTransactionContext, role: string, scope: string, status: 'active' | 'disabled', expectedVersion: number): Promise<Role | null>;
  deleteRole(context: WriteTransactionContext, role: string, scope: string, expectedVersion: number): Promise<boolean>;
  assignRole(context: WriteTransactionContext, role: string, membership: string, issuer: string): Promise<boolean>;
  revokeRole(context: WriteTransactionContext, role: string, membership: string): Promise<boolean>;
  scopePath(context: ReadTransactionContext, scope: string, kind: string): Promise<string | null>;
  grantScope(
    context: WriteTransactionContext,
    input: Readonly<{ id: string; membership: string; kind: string; scope: string; path: string; effect: PermissionEffect; expiresAt: Date | null; expectedVersion: number }>
  ): Promise<Scope | null>;
  lockOverrideTarget(context: WriteTransactionContext, membership: string): Promise<OverrideTarget | null>;
  setOverride(context: WriteTransactionContext, value: Override, issuer: string): Promise<OverrideChange | null>;
  revokeOverride(context: WriteTransactionContext, input: Readonly<{ membership: string; permission: string; reason: string }>): Promise<OverrideChange | null>;
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
  activeMemberships(context: ReadTransactionContext, member: string, target: 'console' | 'storefront' | 'miniapp' | 'store' | 'supplier'): Promise<readonly ActiveMembershipReference[]>;
  lockSession(context: WriteTransactionContext, membership: string, target: 'console' | 'storefront' | 'miniapp' | 'store' | 'supplier'): Promise<number | null>;
  directoryMemberships(context: ReadTransactionContext, memberships: readonly string[]): Promise<readonly DirectoryMembershipReference[]>;
  ensureImported(context: WriteTransactionContext, input: Readonly<{ membership: string; member: string; principal: string; organization: string; client: 'operator' | 'storefront'; employee: string | null }>): Promise<void>;
  activeMember(context: ReadTransactionContext, membership: string): Promise<string | null>;
  activeMemberIn(context: ReadTransactionContext, member: string, organizations: readonly string[]): Promise<boolean>;
  memberPage(context: ReadTransactionContext, organization: string, actorMembership: string, after: string | null, limit: number): Promise<readonly MemberRecord[]>;
  memberProfile(context: ReadTransactionContext, membership: string): Promise<MemberRecord | null>;
  upsertMemberProfile(context: WriteTransactionContext, profile: MemberProfileProjection): Promise<void>;
  setEmployeeNumber(context: WriteTransactionContext, membership: string, employee: string | null): Promise<boolean>;
  managementMember(context: WriteTransactionContext, membership: string): Promise<Readonly<{ member: string; accessVersion: number }> | null>;
  resetMemberRegistrations(context: WriteTransactionContext, member: string, actorMembership: string): Promise<readonly VersionChange[] | null>;
  setMembershipStatus(context: WriteTransactionContext, membership: string, status: 'active' | 'suspended' | 'left'): Promise<boolean>;
  replaceDepartment(context: WriteTransactionContext, input: Readonly<{ membership: string; department: string; path: string; grant: string }>): Promise<void>;
  applyDirectoryState(context: WriteTransactionContext, input: Readonly<{ membership: string; status: 'active' | 'suspended' | 'left' }>): Promise<number | null>;
  replaceDirectoryDepartment(context: WriteTransactionContext, input: Readonly<{ membership: string; department: string; grant: string; accessVersion: number }>): Promise<void>;
}
