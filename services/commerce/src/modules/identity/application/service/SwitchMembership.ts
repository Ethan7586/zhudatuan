import { IdentityAction as OperationAction } from '../model/IdentityAction';
import { requireWriteTransaction } from '../../../../foundation/persistence/TransactionContext';

import { reject } from '../../../../foundation/application/OperationRejection';
import { requireAccess } from '../../../../foundation/application/OperationAccess';

import { bodyRecord, textField } from '../../../../foundation/application/Validation';
import type { IdentityAccessPort } from '../../../access/public';
import type { IdentityMemberPort } from '../../../member/public';
import type { IdentityEventRepository } from '../port/IdentityEventRepository';
import type { SessionIssuer } from '../port/SessionIssuer';
import type { SessionRepository } from '../port/SessionRepository';
import { requestContext } from './StartFederation';

export class SwitchMembership {
  constructor(
    private readonly members: IdentityMemberPort,
    private readonly access: IdentityAccessPort,
    private readonly sessions: SessionIssuer,
    private readonly repository: SessionRepository,
    private readonly events: IdentityEventRepository
  ) {}

  action(): OperationAction {
    return async (request, database) => {
      const current = requireAccess(request);
      const target = textField(bodyRecord(request.input), 'membershipId', 255);
      const member = await this.members.memberForPrincipal(database, current.actor.id);
      const memberships = await this.access.memberships(database, member, current.actor.target);
      const selected = memberships.find(({ id }) => id === target);
      if (!selected) reject('MEMBERSHIP_SELECTION_REQUIRED');
      const revoked = await this.repository.revokeCurrent(database, current.actor.id, current.actor.session);
      if (!revoked) reject('AUTHENTICATION_REQUIRED');
      const context = requestContext(request);
      const issued = await this.sessions.issue(requireWriteTransaction(database), {
        principal: current.actor.id,
        membership: target,
        assurance: current.assurance.level,
        target: current.actor.target,
        device: context.device,
        peer: context.peer,
        agent: context.agent,
        trace: context.trace,
        expectedAccessVersion: selected.accessVersion,
      });
      await this.events.publish(database, 'identity.session.revoked', 'session', current.actor.session, current.membership.id, context.trace, { sessions: [current.actor.session], reason: 'membership_switch' });
      await this.events.publish(database, 'identity.membership.switched', 'membership', target, target, context.trace, {
        principalId: current.actor.id,
        previousMembershipId: current.membership.id,
        membershipId: target,
        previousSessionId: current.actor.session,
        sessionId: issued.session,
      });
      return { status: 200, headers: issued.headers, body: { session: issued.session, membership: target, expiresIn: issued.expiresin, switchedAt: new Date().toISOString() } };
    };
  }
}
