import { isOperationTarget, type OperationInputFor, type OperationOutputFor, type OperationTarget } from '@shop/contract';
import type { WriteHandlerContext } from '../../../../pipeline/HandlerContext';
import type { OperationHandler, OperationReply } from '../../../../pipeline/OperationHandler';
import { bodyRecord, textField } from '../../../../pipeline/Validation';
import { DomainError } from '../../../../platform/error/DomainError';
import { requireSession } from '../../../../platform/security/OperationSecurityContext';
import type { IdentityEventRepository } from '../port/IdentityEventRepository';
import type { HandoverRepository } from '../port/HandoverRepository';
import type { SessionCookiePort } from '../port/SessionCookiePort';
import type { SessionRepository } from '../port/SessionRepository';

export class HandoversCreateHandler implements OperationHandler<'identity.handovers.create', 'write'> {
  readonly operation = 'identity.handovers.create' as const;
  readonly mode = 'write' as const;
  constructor(
    private readonly handovers: HandoverRepository,
    private readonly sessions: SessionRepository,
    private readonly cookies: SessionCookiePort,
    private readonly events: IdentityEventRepository
  ) {}
  async execute(input: OperationInputFor<'identity.handovers.create'>, context: WriteHandlerContext<'identity.handovers.create'>): Promise<OperationReply<OperationOutputFor<'identity.handovers.create'>>> {
    const access = requireSession(context.security);
    if (!context.idempotencyKey) throw new Error('IDENTITY_HANDOVER_IDEMPOTENCY_REQUIRED');
    const record = await this.handovers.create(context.transaction, {
      scope: access.scope.id,
      principal: access.actor.id,
      membership: access.membership.id,
      session: access.actor.session,
      note: textField(bodyRecord(input), 'note', 500),
    });
    const revoked = await this.sessions.revokeCurrent(context.transaction, access.actor.id, access.actor.session, 'store_handover');
    if (!revoked) throw new DomainError('RESOURCE_NOT_FOUND');
    await this.sessions.advance(context.transaction, access.actor.id);
    await this.events.publish(context.transaction, 'identity.session.revoked', 'session', access.actor.session, access.membership.id, context.idempotencyKey, {
      sessions: [access.actor.session],
      reason: 'store_handover',
      handover: record.id,
      store: access.scope.id,
    });
    return {
      status: 200,
      body: { ...record, handedOverAt: record.handedOverAt.toISOString(), sessionRevokedAt: revoked.revokedAt.toISOString() },
      headers: this.cookies.session(target(access.actor.target), '', '', 0),
    };
  }
}

function target(value: string): OperationTarget {
  if (!isOperationTarget(value)) throw new Error('AUTH_RETURN_TARGET_INVALID');
  return value;
}
