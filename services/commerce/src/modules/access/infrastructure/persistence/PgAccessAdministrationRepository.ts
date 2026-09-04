import type { ReadTransactionContext, WriteTransactionContext } from '../../../../foundation/persistence/TransactionContext';
import { AccessVersionPublisher } from '../../application/service/AccessVersionPublisher';
import type { AccessAdministrationRepository } from '../../application/port/AccessAdministrationRepository';
import { PgAccessRepository } from './PgAccessRepository';
export class PgAccessAdministrationRepository implements AccessAdministrationRepository {
  private readonly access = new PgAccessRepository();
  private readonly versions = new AccessVersionPublisher(this.access);
  center(context: ReadTransactionContext, input: Parameters<AccessAdministrationRepository['center']>[1]) {
    return this.access.center(context, input);
  }
  roles(context: ReadTransactionContext, scope: string) {
    return this.access.roles(context, scope);
  }
  roleTemplates(context: ReadTransactionContext) {
    return this.access.roleTemplates(context);
  }
  separationRules(context: ReadTransactionContext) {
    return this.access.separationRules(context);
  }
  lockRole(context: WriteTransactionContext, role: string, scope: string) {
    return this.access.lockRole(context, role, scope);
  }
  rolePermissions(context: ReadTransactionContext, role: string) {
    return this.access.rolePermissions(context, role);
  }
  roleImpact(context: ReadTransactionContext, role: string) {
    return this.access.roleImpact(context, role);
  }
  roleTemplate(context: ReadTransactionContext, code: string) {
    return this.access.roleTemplate(context, code);
  }
  saveRole(context: WriteTransactionContext, input: Parameters<AccessAdministrationRepository['saveRole']>[1]) {
    return this.access.saveRole(context, input);
  }
  setRoleStatus(context: WriteTransactionContext, role: string, scope: string, status: 'active' | 'disabled', expectedVersion: number) {
    return this.access.setRoleStatus(context, role, scope, status, expectedVersion);
  }
  deleteRole(context: WriteTransactionContext, role: string, scope: string, expectedVersion: number) {
    return this.access.deleteRole(context, role, scope, expectedVersion);
  }
  assignRole(context: WriteTransactionContext, role: string, membership: string, issuer: string) {
    return this.access.assignRole(context, role, membership, issuer);
  }
  revokeRole(context: WriteTransactionContext, role: string, membership: string) {
    return this.access.revokeRole(context, role, membership);
  }
  lockMemberships(context: WriteTransactionContext, memberships: readonly string[]) {
    return this.access.lockMemberships(context, memberships);
  }
  bumpRole(context: WriteTransactionContext, role: string, reason: string, trace: string) {
    return this.versions.bumpRole(context, role, reason, trace);
  }
  scopePath(context: WriteTransactionContext, scope: string, kind: string) {
    return this.access.scopePath(context, scope, kind);
  }
  grantScope(context: WriteTransactionContext, input: Parameters<AccessAdministrationRepository['grantScope']>[1]) {
    return this.access.grantScope(context, input);
  }
  lockOverrideTarget(context: WriteTransactionContext, membership: string) {
    return this.access.lockOverrideTarget(context, membership);
  }
  setOverride(context: WriteTransactionContext, value: Parameters<AccessAdministrationRepository['setOverride']>[1], issuer: string) {
    return this.access.setOverride(context, value, issuer);
  }
  revokeOverride(context: WriteTransactionContext, input: Parameters<AccessAdministrationRepository['revokeOverride']>[1]) {
    return this.access.revokeOverride(context, input);
  }
  bump(context: WriteTransactionContext, membership: string, reason: string, trace: string) {
    return this.versions.bump(context, membership, reason, trace);
  }
}
