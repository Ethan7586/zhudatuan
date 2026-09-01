import type { OperationInputFor, OperationOutputFor } from '@shop/contract';
import { DomainError } from '../../../../foundation/domain/DomainError';
import type { WriteHandlerContext } from '../../../../foundation/application/HandlerContext';
import type { OperationHandler, OperationReply } from '../../../../foundation/application/OperationHandler';
import { bodyRecord, textField } from '../../../../foundation/interface/Validation';
import { requireSession } from '../../../../foundation/security/OperationSecurityContext';
import { OwnerPolicy } from '../../domain/policy/OwnerPolicy';
import { PermissionPolicy } from '../../domain/policy/PermissionPolicy';
import type { AccessAdministrationRepository } from '../port/AccessAdministrationRepository';

export class RolesManageHandler implements OperationHandler<'access.roles.manage', 'write'> {
  readonly operation = 'access.roles.manage' as const;
  readonly mode = 'write' as const;
  private readonly permissions = new PermissionPolicy();
  private readonly owners = new OwnerPolicy();
  constructor(private readonly access: AccessAdministrationRepository) {}
  async execute(input: OperationInputFor<'access.roles.manage'>, context: WriteHandlerContext<'access.roles.manage'>): Promise<OperationReply<OperationOutputFor<'access.roles.manage'>>> {
    const identity = requireSession(context.security);
    const body = bodyRecord(input);
    const role = input.path.roleid;
    const allows = stringSet(body.allows, 'allows');
    const denies = stringSet(body.denies, 'denies');
    if (allows.some((permission) => denies.includes(permission))) throw new DomainError('VALIDATION_FAILED', { field: 'allows' });
    this.permissions.assertSubset(identity.membership.permissions.allows, identity.membership.permissions.denies, [...allows, ...denies]);
    const existing = await this.access.lockRole(context.transaction, role, identity.scope.id);
    if (existing) this.owners.assertDelegatable([existing.kind]);
    if (Number(existing?.version ?? 0) !== context.expectedVersion) throw new DomainError('VERSION_CONFLICT');
    const changed = await this.access.saveRole(context.transaction, { role, scope: identity.scope.id, name: textField(body, 'name'), allows, denies, expectedVersion: requiredVersion(context.expectedVersion) });
    if (!changed) throw new DomainError('VERSION_CONFLICT');
    if (changed.allowCount !== allows.length || changed.denyCount !== denies.length) throw new DomainError('VALIDATION_FAILED', { field: 'allows' });
    await this.access.bumpRole(context.transaction, role, 'rolepermissionschanged', context.traceId);
    return { status: 200, body: { id: changed.role.id, scopeId: changed.role.scope, name: changed.role.name, status: 'active', version: changed.role.version, allowCount: changed.allowCount, denyCount: changed.denyCount } };
  }
}

function stringSet(value: unknown, field: string): string[] {
  if (!Array.isArray(value) || value.some((item) => typeof item !== 'string') || new Set(value).size !== value.length) throw new DomainError('VALIDATION_FAILED', { field });
  return value as string[];
}
function requiredVersion(value: number | undefined): number {
  if (value === undefined) throw new DomainError('VERSION_CONFLICT');
  return value;
}
