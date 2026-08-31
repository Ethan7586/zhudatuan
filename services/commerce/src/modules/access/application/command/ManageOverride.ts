import { DomainError } from '../../../../foundation/domain/DomainError';
import type { OperationRequest, OperationResult } from '../../../../foundation/application/OperationExecution';
import type { OperationDatabase } from '../../../../foundation/application/ModuleOperations';
import { requireAccess } from '../../../../foundation/application/ModuleOperations';
import { bodyRecord, textField } from '../../../../foundation/interface/Validation';
import { Override } from '../../domain/model/Override';
import { PermissionPolicy } from '../../domain/policy/PermissionPolicy';
import { AccessVersionService } from '../service/AccessVersionService';
import type { AccessRepository } from '../port/AccessRepository';

export class ManageOverride {
  constructor(
    private readonly repository: AccessRepository,
    private readonly versions: AccessVersionService,
    private readonly permissions = new PermissionPolicy()
  ) {}

  async execute(request: OperationRequest, database: OperationDatabase): Promise<OperationResult> {
    const access = requireAccess(request);
    const body = bodyRecord(request);
    const target = textField(body, 'targetMembership');
    const permission = textField(body, 'permission');
    const reason = textField(body, 'reason', 500);
    if (target === access.membership.id) throw new DomainError('DELEGATION_DENIED');
    this.permissions.assertSubset(access.membership.permissions.allows, access.membership.permissions.denies, [permission]);
    const targetMembership = await this.repository.lockOverrideTarget(database, target);
    if (!targetMembership) throw new DomainError('RESOURCE_NOT_FOUND');
    if (targetMembership.owner) throw new DomainError('OWNER_TRANSFER_REQUIRED');
    if (targetMembership.membership.accessVersion !== request.input.expectedVersion) throw new DomainError('VERSION_CONFLICT');
    const action = body.action;
    let changed;
    if (action === 'set') {
      if (body.effect !== 'allow' && body.effect !== 'deny') throw new DomainError('VALIDATION_FAILED', { field: 'effect' });
      const expires = parseExpiry(body.expiresAt);
      const value = new Override({ membership: target, permission, effect: body.effect, reason, effectiveat: new Date(), expiresat: expires });
      changed = await this.repository.setOverride(database, value, access.membership.id);
    } else if (action === 'revoke') {
      changed = await this.repository.revokeOverride(database, { membership: target, permission, reason });
    } else throw new DomainError('VALIDATION_FAILED', { field: 'action' });
    if (!changed) throw new DomainError(action === 'revoke' ? 'RESOURCE_NOT_FOUND' : 'VALIDATION_FAILED');
    const version = await this.versions.bump(database, target, action === 'revoke' ? 'overriderevoked' : 'overridechanged', access.trace);
    return { status: 200, body: { targetMembership: target, permission, effect: changed.effect, expiresAt: changed.expiresAt?.toISOString() ?? null, revoked: action === 'revoke', accessVersion: version } };
  }
}

function parseExpiry(value: unknown): Date | null {
  if (value === undefined || value === null) return null;
  if (typeof value !== 'string') throw new DomainError('VALIDATION_FAILED', { field: 'expiresAt' });
  const parsed = new Date(value);
  if (!Number.isFinite(parsed.getTime()) || parsed.getTime() <= Date.now()) throw new DomainError('VALIDATION_FAILED', { field: 'expiresAt' });
  return parsed;
}
