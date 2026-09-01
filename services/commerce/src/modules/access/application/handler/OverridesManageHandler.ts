import type { OperationInputFor, OperationOutputFor } from '@shop/contract';
import { DomainError } from '../../../../foundation/domain/DomainError';
import type { WriteHandlerContext } from '../../../../foundation/application/HandlerContext';
import type { OperationHandler, OperationReply } from '../../../../foundation/application/OperationHandler';
import { bodyRecord, textField } from '../../../../foundation/interface/Validation';
import { requireSession } from '../../../../foundation/security/OperationSecurityContext';
import { Override } from '../../domain/model/Override';
import { PermissionPolicy } from '../../domain/policy/PermissionPolicy';
import type { AccessAdministrationRepository } from '../port/AccessAdministrationRepository';

export class OverridesManageHandler implements OperationHandler<'access.overrides.manage', 'write'> {
  readonly operation = 'access.overrides.manage' as const;
  readonly mode = 'write' as const;
  private readonly permissions = new PermissionPolicy();
  constructor(private readonly access: AccessAdministrationRepository) {}
  async execute(input: OperationInputFor<'access.overrides.manage'>, context: WriteHandlerContext<'access.overrides.manage'>): Promise<OperationReply<OperationOutputFor<'access.overrides.manage'>>> {
    const identity = requireSession(context.security);
    const body = bodyRecord(input);
    const target = textField(body, 'targetMembership');
    const permission = textField(body, 'permission');
    const reason = textField(body, 'reason', 500);
    if (target === identity.membership.id) throw new DomainError('DELEGATION_DENIED');
    this.permissions.assertSubset(identity.membership.permissions.allows, identity.membership.permissions.denies, [permission]);
    const targetMembership = await this.access.lockOverrideTarget(context.transaction, target);
    if (!targetMembership) throw new DomainError('RESOURCE_NOT_FOUND');
    if (targetMembership.owner) throw new DomainError('OWNER_TRANSFER_REQUIRED');
    if (targetMembership.membership.accessVersion !== context.expectedVersion) throw new DomainError('VERSION_CONFLICT');
    const action = body.action;
    const changed =
      action === 'set'
        ? await this.set(context, target, permission, reason, body)
        : action === 'revoke'
          ? await this.access.revokeOverride(context.transaction, { membership: target, permission, reason })
          : (() => {
              throw new DomainError('VALIDATION_FAILED', { field: 'action' });
            })();
    if (!changed) throw new DomainError(action === 'revoke' ? 'RESOURCE_NOT_FOUND' : 'VALIDATION_FAILED');
    const version = await this.access.bump(context.transaction, target, action === 'revoke' ? 'overriderevoked' : 'overridechanged', context.traceId);
    return { status: 200, body: { targetMembership: target, permission, effect: changed.effect, expiresAt: changed.expiresAt?.toISOString() ?? null, revoked: action === 'revoke', accessVersion: version } };
  }
  private set(context: WriteHandlerContext<'access.overrides.manage'>, target: string, permission: string, reason: string, body: Readonly<Record<string, unknown>>) {
    if (body.effect !== 'allow' && body.effect !== 'deny') throw new DomainError('VALIDATION_FAILED', { field: 'effect' });
    const value = new Override({ membership: target, permission, effect: body.effect, reason, effectiveat: new Date(), expiresat: parseExpiry(body.expiresAt) });
    return this.access.setOverride(context.transaction, value, requireSession(context.security).membership.id);
  }
}

function parseExpiry(value: unknown): Date | null {
  if (value === undefined || value === null) return null;
  if (typeof value !== 'string') throw new DomainError('VALIDATION_FAILED', { field: 'expiresAt' });
  const parsed = new Date(value);
  if (!Number.isFinite(parsed.getTime()) || parsed.getTime() <= Date.now()) throw new DomainError('VALIDATION_FAILED', { field: 'expiresAt' });
  return parsed;
}
