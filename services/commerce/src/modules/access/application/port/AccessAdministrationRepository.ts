import type { ReadTransactionContext, WriteTransactionContext } from '../../../../foundation/persistence/TransactionContext';
import type { Override } from '../../domain/model/Override';
import type { PermissionEffect, Role, RoleTemplateCode } from '../../domain/model/Role';
import type { Scope } from '../../domain/model/Scope';
import type { Membership } from '../../domain/model/Membership';
import type { AccessCenterRecord, OverrideChange, OverrideTarget, RoleChange, RoleDirectoryRecord, RoleImpact, RolePermissionState, RoleTemplate, SeparationRule } from './AccessRepository';

export interface AccessAdministrationRepository {
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
  lockMemberships(context: WriteTransactionContext, memberships: readonly string[]): Promise<readonly Membership[]>;
  bumpRole(context: WriteTransactionContext, role: string, reason: string, trace: string): Promise<void>;
  scopePath(context: WriteTransactionContext, scope: string, kind: string): Promise<string | null>;
  grantScope(
    context: WriteTransactionContext,
    input: Readonly<{ id: string; membership: string; kind: string; scope: string; path: string; effect: PermissionEffect; expiresAt: Date | null; expectedVersion: number }>
  ): Promise<Scope | null>;
  lockOverrideTarget(context: WriteTransactionContext, membership: string): Promise<OverrideTarget | null>;
  setOverride(context: WriteTransactionContext, value: Override, issuer: string): Promise<OverrideChange | null>;
  revokeOverride(context: WriteTransactionContext, input: Readonly<{ membership: string; permission: string; reason: string }>): Promise<OverrideChange | null>;
  bump(context: WriteTransactionContext, membership: string, reason: string, trace: string): Promise<number>;
}
