import { DomainError } from '../../../../foundation/domain/DomainError';
import type { OperationRequest, OperationResult } from '../../../../foundation/application/OperationExecution';
import type { OperationDatabase } from '../../../../foundation/application/ModuleOperations';
import { requireAccess } from '../../../../foundation/application/ModuleOperations';
import { bodyRecord, textField } from '../../../../foundation/interface/Validation';
import { AccessVersionService } from '../service/AccessVersionService';
import { PermissionPolicy } from '../../domain/policy/PermissionPolicy';
import { OwnerPolicy } from '../../domain/policy/OwnerPolicy';
import type { AccessRepository } from '../port/AccessRepository';

export class ManageRole {
  constructor(
    private readonly repository: AccessRepository,
    private readonly versions: AccessVersionService,
    private readonly permissions = new PermissionPolicy(),
    private readonly owners = new OwnerPolicy()
  ) {}

  async execute(request: OperationRequest, database: OperationDatabase): Promise<OperationResult> {
    const access = requireAccess(request);
    const body = bodyRecord(request);
    const role = request.input.path.roleid!;
    const allows = body.allows;
    const denies = body.denies;
    if (
      !Array.isArray(allows) ||
      !Array.isArray(denies) ||
      [...allows, ...denies].some((item) => typeof item !== 'string') ||
      new Set(allows).size !== allows.length ||
      new Set(denies).size !== denies.length ||
      allows.some((permission) => denies.includes(permission))
    ) {
      throw new DomainError('VALIDATION_FAILED', { field: 'allows' });
    }
    this.permissions.assertSubset(access.membership.permissions.allows, access.membership.permissions.denies, [...(allows as string[]), ...(denies as string[])]);
    const existing = await this.repository.lockRole(database, role, access.scope.id);
    if (existing) this.owners.assertDelegatable([existing.kind]);
    if (Number(existing?.version ?? 0) !== request.input.expectedVersion) throw new DomainError('VERSION_CONFLICT');
    const changed = await this.repository.saveRole(database, { role, scope: access.scope.id, name: textField(body, 'name'), allows: allows as string[], denies: denies as string[], expectedVersion: request.input.expectedVersion! });
    if (!changed) throw new DomainError('VERSION_CONFLICT');
    if (changed.allowCount !== allows.length || changed.denyCount !== denies.length) {
      throw new DomainError('VALIDATION_FAILED', { field: 'allows' });
    }
    await this.versions.bumpRole(database, role, 'rolepermissionschanged', access.trace);
    return { status: 200, body: { id: changed.role.id, scopeId: changed.role.scope, name: changed.role.name, status: changed.role.status, version: changed.role.version, allowCount: changed.allowCount, denyCount: changed.denyCount } };
  }
}
