import { identityLifecycle as operationLifecycle, type IdentityLifecycle as OperationLifecycle } from '../model/IdentityAction';
import type { ReadTransactionContext, WriteTransactionContext } from '../../../../platform/database/TransactionContext';
import { requireWriteTransaction } from '../../../../platform/database/TransactionContext';
import { DomainError } from '../../../../platform/error/DomainError';
import { createHmac } from 'node:crypto';

import { bodyRecord, textField } from '../../../../pipeline/Validation';
import { requirePreauth } from '../../../../platform/security/OperationSecurityContext';
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
import { returnDestination } from './ReturnDestination';

export interface SessionCompletionScope {
  readonly invitation: string;
  readonly scope: string;
}

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
  lifecycle(): OperationLifecycle<SessionCompletionScope, SessionCompletionScope> {
    return operationLifecycle({
      load: (request, context) => this.load(request, context),
      execute: (request, context, prepared) => this.complete(request, context, prepared),
    });
  }

  private async load(request: Parameters<OperationLifecycle['execute']>[0], context: ReadTransactionContext): Promise<SessionCompletionScope> {
    const preauth = requirePreauth(request.security, 'invitationproof');
    const invitation = await this.repository.claimed(context, preauth.reference, preauth.target);
    return Object.freeze({ invitation: invitation.state.id, scope: invitation.state.organization });
  }

  private async complete(request: Parameters<OperationLifecycle['execute']>[0], database: WriteTransactionContext, prepared: SessionCompletionScope) {
    const preauth = requirePreauth(request.security, 'invitationproof');
    const body = bodyRecord(request.input);
    const destination = returnDestination(this.returns, preauth.target, body.returnTarget);
    const invitation = await this.repository.lockClaimed(requireWriteTransaction(database), preauth.reference, preauth.target);
    const claim = await this.repository.claim(requireWriteTransaction(database), preauth.reference);
    if (invitation.state.id !== prepared.invitation || invitation.state.organization !== prepared.scope || !invitation.state.principal || !invitation.state.membership || !invitation.state.recipientHash) {
      throw new DomainError('INVITATION_INVALID');
    }
    try {
      await this.redeemer.validate(database, invitation, preauth.target);
    } catch (cause) {
      return this.failures.reject(database, request, invitation.state.id, invitation.state.organization, cause, 'INVITATION_INVALID');
    }
    try {
      await this.challenges.consume(requireWriteTransaction(database), textField(body, 'proof'), textField(body, 'code', 16), (id, code) => this.code(id, code), invitation.state.principal, {
        purpose: 'invitation_login',
        destinationHash: invitation.state.recipientHash.toString('hex'),
      });
    } catch (cause) {
      await this.failures.record(database, request, invitation.state.id, invitation.state.organization, cause);
      throw cause;
    }
    await this.assurances.record(requireWriteTransaction(database), {
      principal: invitation.state.principal,
      method: 'invitation_otp',
      level: 2,
      evidenceHash: createHmac('sha256', this.sessionKey).update(preauth.reference).digest('hex'),
      expiresIn: '15minutes',
    });
    const session = await this.sessions.issue(requireWriteTransaction(database), {
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
    const ticket = await this.tickets.issue(requireWriteTransaction(database), session.session, preauth.target, AuthTransaction.start(body.authorization));
    return { status: 201, body: { kind: 'session', ticket: ticket.ticket, returnTarget: destination.proof }, headers: { ...session.headers, 'x-clear-cookie': this.cookies.preauth('', 0) } };
  }
  private code(id: string, code: string): string {
    return createHmac('sha256', this.sessionKey).update(`${id}:${code}`).digest('hex');
  }
}
