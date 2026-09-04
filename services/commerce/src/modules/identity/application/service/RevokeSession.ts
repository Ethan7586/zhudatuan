import { IdentityAction as OperationAction } from '../model/IdentityAction';
import { reject } from '../../../../foundation/application/OperationRejection';
import { requireAccess } from '../../../../foundation/application/OperationAccess';

import type { SessionRepository } from '../port/SessionRepository';
import type { SessionCookiePort } from '../port/SessionCookiePort';
import type { IdentityEventRepository } from '../port/IdentityEventRepository';
import { isOperationTarget, type OperationTarget } from '@shop/contract';

export class RevokeSession {
  constructor(
    private readonly sessions: SessionRepository,
    private readonly cookies: SessionCookiePort,
    private readonly events: IdentityEventRepository
  ) {}
  current(): OperationAction {
    return async (request, database) => {
      const access = requireAccess(request);
      const revoked = await this.sessions.revokeCurrent(database, access.actor.id, access.actor.session);
      if (!revoked) reject('RESOURCE_NOT_FOUND');
      await this.sessions.advance(database, access.actor.id);
      await this.events.publish(database, 'identity.session.revoked', 'session', access.actor.session, access.membership.id, request.input.idempotency!, { sessions: [access.actor.session], reason: 'logout' });
      return { status: 200, body: { session: revoked.id, revokedAt: revoked.revokedAt.toISOString() }, headers: this.cookies.session(target(access.actor.target), '', '', 0) };
    };
  }
  selected(): OperationAction {
    return async (request, database) => {
      const access = requireAccess(request);
      const session = request.input.path.sessionid;
      if (!session) reject('RESOURCE_NOT_FOUND');
      const revoked = await this.sessions.revokeSelected(database, access.actor.id, access.actor.session, session);
      if (session !== 'others' && revoked.length === 0 && !(await this.sessions.owns(database, access.actor.id, session))) reject('RESOURCE_NOT_FOUND');
      if (revoked.length) {
        await this.sessions.advance(database, access.actor.id);
        await this.events.publish(database, 'identity.session.revoked', 'session', session, access.membership.id, request.input.idempotency!, { sessions: revoked, reason: 'security_center' });
      }
      const response = { status: 200, body: { target: session, revoked: revoked.length, sessions: revoked } } as const;
      return session === access.actor.session ? { ...response, headers: this.cookies.session(target(access.actor.target), '', '', 0) } : response;
    };
  }
}
function target(value: string): OperationTarget {
  if (!isOperationTarget(value)) throw new Error('AUTH_RETURN_TARGET_INVALID');
  return value;
}
