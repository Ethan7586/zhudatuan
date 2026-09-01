import type { ReadTransactionContext, WriteTransactionContext } from '../../../../foundation/persistence/TransactionContext';
import { AccessVersionService } from '../../application/service/AccessVersionService';
import type { AccessAdministrationRepository } from '../../application/port/AccessAdministrationRepository';
import { PgAccessRepository } from './PgAccessRepository';
export class PgAccessAdministrationRepository implements AccessAdministrationRepository {
  private readonly access = new PgAccessRepository();
  private readonly versions = new AccessVersionService(this.access);
  center(context: ReadTransactionContext, input: Parameters<AccessAdministrationRepository['center']>[1]) {
    return this.access.center(context, input);
  }
  lockRole(context: WriteTransactionContext, role: string, scope: string) {
    return this.access.lockRole(context, role, scope);
  }
  saveRole(context: WriteTransactionContext, input: Parameters<AccessAdministrationRepository['saveRole']>[1]) {
    return this.access.saveRole(context, input);
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
  lockOwnership(context: WriteTransactionContext, scope: string) {
    return this.access.lockOwnership(context, scope);
  }
  lockMemberships(context: WriteTransactionContext, memberships: readonly string[]) {
    return this.access.lockMemberships(context, memberships);
  }
  expireRole(context: WriteTransactionContext, membership: string, role: string) {
    return this.access.expireRole(context, membership, role);
  }
  assignRole(context: WriteTransactionContext, input: Parameters<AccessAdministrationRepository['assignRole']>[1]) {
    return this.access.assignRole(context, input);
  }
  transferOwnership(context: WriteTransactionContext, input: Parameters<AccessAdministrationRepository['transferOwnership']>[1]) {
    return this.access.transferOwnership(context, input);
  }
  ownerTransferred(context: WriteTransactionContext, input: Parameters<AccessAdministrationRepository['ownerTransferred']>[1]) {
    return this.access.ownerTransferred(context, input);
  }
  bump(context: WriteTransactionContext, membership: string, reason: string, trace: string) {
    return this.versions.bump(context, membership, reason, trace);
  }
}
