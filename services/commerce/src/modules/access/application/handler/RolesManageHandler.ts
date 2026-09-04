import type { OperationInputFor, OperationOutputFor } from '@shop/contract';
import { DomainError } from '../../../../foundation/domain/DomainError';
import type { WriteHandlerContext } from '../../../../foundation/application/HandlerContext';
import type { OperationHandler, OperationReply } from '../../../../foundation/application/OperationHandler';
import { bodyRecord, textField } from '../../../../foundation/application/Validation';
import { requireSession } from '../../../../foundation/security/OperationSecurityContext';
import { OwnerPolicy } from '../../domain/policy/OwnerPolicy';
import { PermissionPolicy } from '../../domain/policy/PermissionPolicy';
import { SeparationPolicy } from '../../domain/policy/SeparationPolicy';
import { isRoleTemplateCode, Role } from '../../domain/model/Role';
import type { RolePermissionDiff, RoleTemplateCode } from '../../domain/model/Role';
import type { AccessAdministrationRepository } from '../port/AccessAdministrationRepository';

export class RolesManageHandler implements OperationHandler<'access.roles.manage', 'write'> {
  readonly operation = 'access.roles.manage' as const;
  readonly mode = 'write' as const;
  private readonly permissions = new PermissionPolicy();
  private readonly owners = new OwnerPolicy();
  private readonly separation = new SeparationPolicy();
  constructor(private readonly access: AccessAdministrationRepository) {}
  async execute(input: OperationInputFor<'access.roles.manage'>, context: WriteHandlerContext<'access.roles.manage'>): Promise<OperationReply<OperationOutputFor<'access.roles.manage'>>> {
    const identity = requireSession(context.security);
    const body = bodyRecord(input);
    const role = input.path.roleid;
    const action = textField(body, 'action');
    if (action === 'save') return this.save(role, body, context, identity);
    const existing = await this.access.lockRole(context.transaction, role, identity.scope.id);
    if (!existing || existing.kind !== 'custom') throw new DomainError('RESOURCE_NOT_FOUND');
    this.owners.assertDelegatable([existing.kind]);
    if (action === 'status') return this.status(existing, body, context);
    if (action === 'assign' || action === 'revoke') return this.assignment(existing, action, body, context, identity);
    if (action === 'delete') return this.delete(existing, context);
    throw new DomainError('VALIDATION_FAILED', { field: 'action' });
  }

  private async save(
    role: string,
    body: Readonly<Record<string, unknown>>,
    context: WriteHandlerContext<'access.roles.manage'>,
    identity: ReturnType<typeof requireSession>
  ): Promise<OperationReply<OperationOutputFor<'access.roles.manage'>>> {
    const requestedAllows = stringSet(body.allows, 'allows');
    const requestedDenies = stringSet(body.denies, 'denies');
    const template = roleTemplate(body.template);
    const baseline = template === null ? null : await this.access.roleTemplate(context.transaction, template);
    if (template !== null && baseline === null) throw new DomainError('VALIDATION_FAILED', { field: 'template' });
    const denies = [...new Set(requestedDenies)].sort();
    const allows = [...new Set(requestedAllows)].filter((permission) => !denies.includes(permission)).sort();
    if (allows.some((permission) => denies.includes(permission))) throw new DomainError('ACCESS_GRANT_CONFLICT', { field: 'allows' });
    this.separation.assertPermissions(await this.access.separationRules(context.transaction), allows, denies);
    this.permissions.assertSubset(identity.membership.permissions.allows, identity.membership.permissions.denies, [...allows, ...denies]);
    const existing = await this.access.lockRole(context.transaction, role, identity.scope.id);
    if (existing) this.owners.assertDelegatable([existing.kind]);
    if (Number(existing?.version ?? 0) !== context.expectedVersion) throw new DomainError('VERSION_CONFLICT');
    const current = await this.access.rolePermissions(context.transaction, role);
    const affected = await this.access.roleImpact(context.transaction, role);
    const impact = (existing ?? new Role({ id: role, scope: identity.scope.id, name: textField(body, 'name'), status: 'active', version: 0, kind: 'custom' })).permissionDiff(current, { allows, denies }, affected);
    const changed = await this.access.saveRole(context.transaction, {
      role,
      scope: identity.scope.id,
      name: textField(body, 'name'),
      description: limitedText(body, 'description', 300),
      template,
      allows,
      denies,
      expectedVersion: requiredVersion(context.expectedVersion),
    });
    if (!changed) throw new DomainError('VERSION_CONFLICT');
    if (changed.allowCount !== allows.length || changed.denyCount !== denies.length) throw new DomainError('VALIDATION_FAILED', { field: 'allows' });
    await this.access.bumpRole(context.transaction, role, 'rolepermissionschanged', context.traceId);
    return { status: 200, body: { action: 'save', id: changed.role.id, scopeId: changed.role.scope, name: changed.role.name, description: changed.role.description, status: changed.role.status, version: changed.role.version, allowCount: changed.allowCount, denyCount: changed.denyCount, template, impact } };
  }

  private async status(existing: Role, body: Readonly<Record<string, unknown>>, context: WriteHandlerContext<'access.roles.manage'>): Promise<OperationReply<OperationOutputFor<'access.roles.manage'>>> {
    this.assertVersion(existing.version, context.expectedVersion);
    const status = body.status;
    if (status !== 'active' && status !== 'disabled') throw new DomainError('VALIDATION_FAILED', { field: 'status' });
    const [permissions, affected] = await Promise.all([this.access.rolePermissions(context.transaction, existing.id), this.access.roleImpact(context.transaction, existing.id)]);
    const impact = existing.permissionDiff(permissions, permissions, affected);
    const changed = existing.status === status ? existing : await this.access.setRoleStatus(context.transaction, existing.id, existing.scope, status, existing.version);
    if (!changed) throw new DomainError('VERSION_CONFLICT');
    if (changed !== existing) await this.access.bumpRole(context.transaction, existing.id, status === 'active' ? 'roleactivated' : 'roledisabled', context.traceId);
    return { status: 200, body: { action: 'status', id: changed.id, status: changed.status, version: changed.version, impact } };
  }

  private async assignment(
    existing: Role,
    action: 'assign' | 'revoke',
    body: Readonly<Record<string, unknown>>,
    context: WriteHandlerContext<'access.roles.manage'>,
    identity: ReturnType<typeof requireSession>
  ): Promise<OperationReply<OperationOutputFor<'access.roles.manage'>>> {
    if (existing.status !== 'active' && action === 'assign') throw new DomainError('ACCESS_GRANT_CONFLICT');
    const targetMembership = textField(body, 'targetMembership');
    const target = (await this.access.lockMemberships(context.transaction, [targetMembership]))[0];
    if (!target || target.organization !== identity.scope.id || target.status !== 'active') throw new DomainError('RESOURCE_NOT_FOUND');
    this.assertVersion(target.accessVersion, context.expectedVersion);
    if (action === 'assign') {
      const permissions = await this.access.rolePermissions(context.transaction, existing.id);
      this.permissions.assertSubset(identity.membership.permissions.allows, identity.membership.permissions.denies, [...permissions.allows, ...permissions.denies]);
    }
    const changed = action === 'assign'
      ? await this.access.assignRole(context.transaction, existing.id, target.id, identity.membership.id)
      : await this.access.revokeRole(context.transaction, existing.id, target.id);
    if (!changed) throw new DomainError('ACCESS_GRANT_CONFLICT');
    const accessVersion = await this.access.bump(context.transaction, target.id, action === 'assign' ? 'roleassigned' : 'rolerevoked', context.traceId);
    return { status: 200, body: { action, id: existing.id, targetMembership, accessVersion, changed: true } };
  }

  private async delete(existing: Role, context: WriteHandlerContext<'access.roles.manage'>): Promise<OperationReply<OperationOutputFor<'access.roles.manage'>>> {
    this.assertVersion(existing.version, context.expectedVersion);
    const [permissions, affected] = await Promise.all([this.access.rolePermissions(context.transaction, existing.id), this.access.roleImpact(context.transaction, existing.id)]);
    const impact = existing.permissionDiff(permissions, { allows: [], denies: [] }, affected);
    if (impact.affectedPeople > 0) throw new DomainError('ACCESS_GRANT_CONFLICT');
    if (!(await this.access.deleteRole(context.transaction, existing.id, existing.scope, existing.version))) throw new DomainError('VERSION_CONFLICT');
    return { status: 200, body: { action: 'delete', id: existing.id, version: existing.version, deleted: true, impact } };
  }

  private assertVersion(actual: number, expected: number | undefined): void {
    if (actual !== expected) throw new DomainError('VERSION_CONFLICT');
  }
}
function roleTemplate(value: unknown): RoleTemplateCode | null {
  if (value === undefined) return null;
  if (isRoleTemplateCode(value)) return value;
  throw new DomainError('VALIDATION_FAILED', { field: 'template' });
}

function stringSet(value: unknown, field: string): string[] {
  if (!Array.isArray(value) || value.some((item) => typeof item !== 'string') || new Set(value).size !== value.length) throw new DomainError('VALIDATION_FAILED', { field });
  return value as string[];
}
function requiredVersion(value: number | undefined): number {
  if (value === undefined) throw new DomainError('VERSION_CONFLICT');
  return value;
}

function limitedText(body: Readonly<Record<string, unknown>>, field: string, maximum: number): string {
  const value = textField(body, field).trim();
  if (value.length === 0 || value.length > maximum) throw new DomainError('VALIDATION_FAILED', { field });
  return value;
}
