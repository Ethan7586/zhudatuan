import { randomUUID } from 'node:crypto';
import type { OperationInputFor, OperationOutputFor } from '@shop/contract';
import { DomainError } from '../../../../platform/error/DomainError';
import type { WriteHandlerContext } from '../../../../pipeline/HandlerContext';
import type { OperationHandler, OperationReply } from '../../../../pipeline/OperationHandler';
import { bodyRecord, textField } from '../../../../pipeline/Validation';
import { requireSession } from '../../../../platform/security/OperationSecurityContext';
import type { AccessAdministrationRepository } from '../port/AccessAdministrationRepository';

export class ScopesManageHandler implements OperationHandler<'access.scopes.manage', 'write'> {
  readonly operation = 'access.scopes.manage' as const;
  readonly mode = 'write' as const;
  constructor(private readonly access: AccessAdministrationRepository) {}
  async execute(input: OperationInputFor<'access.scopes.manage'>, context: WriteHandlerContext<'access.scopes.manage'>): Promise<OperationReply<OperationOutputFor<'access.scopes.manage'>>> {
    requireSession(context.security);
    const body = bodyRecord(input);
    const membership = textField(body, 'targetMembership');
    const kind = scopeKind(textField(body, 'kind'));
    const scope = textField(body, 'scope');
    const effect = body.effect === 'deny' ? 'deny' : 'allow';
    const path = await this.access.scopePath(context.transaction, scope, kind);
    if (path === null) throw new DomainError('SCOPE_DENIED');
    const changed = await this.access.grantScope(context.transaction, { id: `scope:${randomUUID()}`, membership, kind, scope, path, effect, expiresAt: expiry(body.expiresAt), expectedVersion: requiredVersion(context.expectedVersion) });
    if (!changed) throw new DomainError('VERSION_CONFLICT');
    const version = await this.access.bump(context.transaction, membership, 'scopegrantchanged', context.traceId);
    return { status: 200, body: { id: changed.id, membershipId: changed.membership, kind, scope: changed.resource, effect: changed.effect, expiresAt: changed.expiresAt?.toISOString() ?? null, accessVersion: version } };
  }
}

function expiry(value: unknown): Date | null {
  if (value === undefined || value === null) return null;
  if (typeof value !== 'string') throw new DomainError('VALIDATION_FAILED');
  const parsed = new Date(value);
  if (!Number.isFinite(parsed.getTime()) || parsed.getTime() <= Date.now()) throw new DomainError('VALIDATION_FAILED');
  return parsed;
}
function requiredVersion(value: number | undefined): number {
  if (value === undefined) throw new DomainError('VERSION_CONFLICT');
  return value;
}
function scopeKind(value: string): 'platform' | 'distributor' | 'tenant' | 'enterprise' | 'mall' | 'department' | 'store' | 'supplier' | 'brand' | 'self' | 'owner' {
  const allowed = ['platform', 'distributor', 'tenant', 'enterprise', 'mall', 'department', 'store', 'supplier', 'brand', 'self', 'owner'] as const;
  if (!allowed.includes(value as (typeof allowed)[number])) throw new DomainError('VALIDATION_FAILED', { field: 'kind' });
  return value as (typeof allowed)[number];
}
