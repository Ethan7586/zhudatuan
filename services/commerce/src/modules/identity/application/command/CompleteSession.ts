import { DomainError } from '../../../../foundation/domain/DomainError';
import { createHmac } from 'node:crypto';
import type { OperationAction } from '../../../../foundation/application/ModuleOperations';
import { bodyRecord, textField } from '../../../../foundation/interface/Validation';
import { requirePreauth } from '../../../../foundation/security/OperationSecurityContext';
import type { InvitationRepository } from '../port/InvitationRepository';
import type { ReturnTargetPort } from '../port/ReturnTargetPort';
import type { SessionIssuer } from '../port/SessionIssuer';
import type { ChallengePort } from '../port/ChallengePort';
import type { AuthTicketPort } from '../port/AuthTicketPort';
import { AuthTransaction } from '../../domain/model/AuthTransaction';
import type { InvitationRedeemer } from '../service/InvitationRedeemer';
import type { SessionCookiePort } from '../port/SessionCookiePort';
import type { AssuranceRepository } from '../port/AssuranceRepository';
import type { InvitationFailure } from '../service/InvitationFailure';

export class CompleteSession {
  constructor(
    private readonly repository: InvitationRepository,
    private readonly redeemer: InvitationRedeemer,
    private readonly sessions: SessionIssuer,
    private readonly returns: ReturnTargetPort,
    private readonly sessionKey: string,
    private readonly tickets: AuthTicketPort,
    private readonly challenges: ChallengePort,
    private readonly cookies: SessionCookiePort,
    private readonly assurances: AssuranceRepository,
    private readonly failures: InvitationFailure
  ) {}
  action(): OperationAction {
    return async (request, database) => {
      const preauth = requirePreauth(request.security, 'invitationproof');
      const body = bodyRecord(request);
      const invitation = await this.repository.claimed(database, preauth.reference, preauth.target, true);
      const claim = await this.repository.claim(database, preauth.reference);
      if (!invitation.state.principal || !invitation.state.membership || !invitation.state.recipientHash) throw new DomainError('INVITATION_INVALID');
      try {
        await this.redeemer.validate(database, invitation, preauth.target);
      } catch (cause) {
        return this.failures.reject(database, request, invitation.state.id, invitation.state.organization, cause, 'INVITATION_INVALID');
      }
      try {
        await this.challenges.consume(database, textField(body, 'proof'), textField(body, 'code', 16), (id, code) => this.code(id, code), invitation.state.principal, {
          purpose: 'invitation_login',
          destinationHash: invitation.state.recipientHash.toString('hex'),
        });
      } catch (cause) {
        await this.failures.record(database, request, invitation.state.id, invitation.state.organization, cause);
        throw cause;
      }
      await this.assurances.record(database, {
        principal: invitation.state.principal,
        method: 'invitation_otp',
        level: 2,
        evidenceHash: createHmac('sha256', this.sessionKey).update(preauth.reference).digest('hex'),
        expiresIn: '15minutes',
      });
      const session = await this.sessions.issue(database, {
        principal: invitation.state.principal,
        membership: invitation.state.membership,
        assurance: 2,
        target: preauth.target,
        device: request.input.headers['x-device-id'] ?? 'browser',
        peer: request.input.headers['x-peer-address'] ?? 'unknown',
        agent: request.input.headers['user-agent'] ?? 'unknown',
        trace: preauth.trace,
      });
      await this.redeemer.consume(database, invitation, { session: session.session, assurance: 2, trace: preauth.trace, claim: { id: preauth.reference, version: claim.version } });
      const ticket = await this.tickets.issue(database, session.session, preauth.target, AuthTransaction.start(body.authorization));
      return { status: 201, body: { kind: 'session', ticket: ticket.ticket, returnTarget: this.returns.issue(preauth.target).proof }, headers: { ...session.headers, 'x-clear-cookie': this.cookies.preauth('', 0) } };
    };
  }
  private code(id: string, code: string): string {
    return createHmac('sha256', this.sessionKey).update(`${id}:${code}`).digest('hex');
  }
}
