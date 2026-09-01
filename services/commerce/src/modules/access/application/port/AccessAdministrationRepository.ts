import type { ReadTransactionContext, WriteTransactionContext } from '../../../../foundation/persistence/TransactionContext';
import type { Membership } from '../../domain/model/Membership';
import type { Override } from '../../domain/model/Override';
import type { PermissionEffect, Role } from '../../domain/model/Role';
import type { Scope } from '../../domain/model/Scope';
import type { AccessCenterRecord, OverrideChange, OverrideTarget, Ownership, RoleChange } from './AccessRepository';

export interface AccessAdministrationRepository {
  center(context: ReadTransactionContext, input: Readonly<{ organization: string; after: string | null; limit: number }>): Promise<readonly AccessCenterRecord[]>;
  lockRole(context: WriteTransactionContext, role: string, scope: string): Promise<Role | null>;
  saveRole(context: WriteTransactionContext, input: Readonly<{ role: string; scope: string; name: string; allows: readonly string[]; denies: readonly string[]; expectedVersion: number }>): Promise<RoleChange | null>;
  bumpRole(context: WriteTransactionContext, role: string, reason: string, trace: string): Promise<void>;
  scopePath(context: WriteTransactionContext, scope: string, kind: string): Promise<string | null>;
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
  bump(context: WriteTransactionContext, membership: string, reason: string, trace: string): Promise<number>;
}
