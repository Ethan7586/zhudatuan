import { createHash, createHmac, randomBytes, randomInt, randomUUID } from 'node:crypto';
import type { OperationDatabase } from '../../../../foundation/application/ModuleOperations';
import type { OperationRequest } from '../../../../foundation/application/OperationExecution';
import type { InvitationAccessPort } from '../../../access/public';
import type { KmsClient } from '../../../../foundation/infrastructure/KmsClient';
import type { InvitationRepository } from '../port/InvitationRepository';
import type { InvitationHashPort } from '../port/InvitationSecurity';
import type { ReturnTargetPort } from '../port/ReturnTargetPort';
import type { SessionIssuer } from '../port/SessionIssuer';
import type { AuthTicketPort } from '../port/AuthTicketPort';
import type { FederationProtector } from '../../domain/service/FederationProtector';
import type { AuthenticationBody, AuthenticationReply, AuthenticationStrategy } from './AuthenticationStrategy';
import { AuthTransaction } from '../../domain/model/AuthTransaction';
import type { IdentityMemberPort, InvitationMemberPort } from '../../../member/public';
import type { InvitationGuard } from '../service/InvitationGuard';
import { DomainError } from '../../../../foundation/domain/DomainError';
import type { InvitationRedeemer } from '../service/InvitationRedeemer';
import type { SessionCookiePort } from '../port/SessionCookiePort';
import type { ChallengePort } from '../port/ChallengePort';
import type { InvitationFailure } from '../service/InvitationFailure';
import type { InvitationLookup } from '../service/InvitationLookup';

export class InvitationAuthenticator implements AuthenticationStrategy {
  readonly method = 'invitation' as const;
  constructor(
    private readonly repository: InvitationRepository,
    private readonly access: InvitationAccessPort,
    private readonly hasher: InvitationHashPort,
    private readonly protector: FederationProtector,
    private readonly sessions: SessionIssuer,
    private readonly returns: ReturnTargetPort,
    private readonly tickets: AuthTicketPort,
    private readonly members: IdentityMemberPort,
    private readonly invited: InvitationMemberPort,
    private readonly kms: KmsClient,
    private readonly sessionKey: string,
    private readonly guard: InvitationGuard,
    private readonly redeemer: InvitationRedeemer,
    private readonly cookies: SessionCookiePort,
    private readonly challenges: ChallengePort,
    private readonly failures: InvitationFailure,
    private readonly lookup: InvitationLookup
  ) {}

  async authenticate(request: OperationRequest, database: OperationDatabase, body: AuthenticationBody): Promise<AuthenticationReply> {
    if (body.method !== this.method) throw new Error('AUTHENTICATION_METHOD_MISMATCH');
    const target = targetOf(body.target);
    await this.guard.assert(request, target);
    const invitation = await this.lookup.find(database, body.code, target, true);
    await this.guard.assertRecipient(request, target, invitation.state.recipientHash);
    const peer = request.input.headers['x-peer-address'] ?? 'unknown';
    const agent = request.input.headers['user-agent'] ?? 'unknown';
    const device = request.input.headers['x-device-id'] ?? 'browser';
    const trace = request.input.headers['x-trace-id'] ?? request.input.idempotency!;
    if (invitation.requiresEnrollment()) {
      let principal: string | null = null;
      if (invitation.state.membership) {
        const member = await this.access.pending(database, invitation.state.membership);
        principal = (await this.invited.pending(database, member)).principal;
      }
      const token = randomBytes(48).toString('base64url');
      const claim = randomUUID();
      await this.repository.reserve(database, invitation, {
        claim,
        preauth: createHash('sha256').update(token).digest(),
        browser: this.protector.browser(peer, agent, device),
        device: this.protector.device(device),
        recipient: invitation.state.recipientHash,
        principal,
        proof: 'otp',
      });
      const headers = Object.freeze({ 'set-cookie': this.cookies.preauth(token) });
      return { status: 202, headers, result: { kind: 'enrollment', enrollment: { id: claim, expiresAt: new Date(Date.now() + 300_000).toISOString(), target: 'storefront' } } };
    }
    if (invitation.requiresProof()) {
      const principal = invitation.state.principal;
      const recipient = invitation.state.recipientHash;
      if (!principal || !recipient) throw new DomainError('INVITATION_INVALID');
      const profile = await this.members.securityProfile(database, principal);
      if (!profile.mobileCiphertext) throw new DomainError('PROOF_REQUIRED');
      const destination = await this.kms.decrypt('pii', 'identity/mobile', profile.mobileCiphertext, { principal });
      if (!this.hasher.matchesRecipient(destination, recipient)) throw new DomainError('INVITATION_INVALID');
      const token = randomBytes(48).toString('base64url');
      const claim = randomUUID();
      await this.repository.reserve(database, invitation, {
        claim,
        preauth: createHash('sha256').update(token).digest(),
        browser: this.protector.browser(peer, agent, device),
        device: this.protector.device(device),
        recipient,
        principal,
        proof: 'otp',
      });
      const headers = Object.freeze({ 'set-cookie': this.cookies.preauth(token) });
      const challenge = `challenge:${randomUUID()}`;
      const otp = String(randomInt(0, 1_000_000)).padStart(6, '0');
      const purpose = 'invitation_login';
      const [codeEnvelope, destinationEnvelope] = await Promise.all([this.kms.encrypt('pii', 'identity/challenge', otp, { challenge, purpose }), this.kms.encrypt('pii', 'identity/destination', destination, { challenge, purpose })]);
      const issued = await this.challenges.issue(database, {
        id: challenge,
        principal,
        purpose,
        destinationHash: recipient.toString('hex'),
        codeHash: this.code(challenge, otp),
        codeCiphertext: codeEnvelope.ciphertext,
        codeKeyVersion: codeEnvelope.keyVersion,
        destinationCiphertext: destinationEnvelope.ciphertext,
        destinationKeyVersion: destinationEnvelope.keyVersion,
        scope: invitation.state.organization,
        ttlMinutes: 5,
        queueDelivery: true,
      });
      return { status: 202, headers, result: { kind: 'proofRequired', proof: { reference: challenge, expiresAt: issued.expiresAt.toISOString(), method: 'otp', target } } };
    }
    if (!invitation.state.membership || !invitation.state.principal) throw new DomainError('INVITATION_INVALID');
    try {
      await this.redeemer.validate(database, invitation, target);
    } catch (cause) {
      return this.failures.reject(database, request, invitation.state.id, invitation.state.organization, cause, 'INVITATION_INVALID');
    }
    const session = await this.sessions.issue(database, { principal: invitation.state.principal, membership: invitation.state.membership, assurance: 1, target, device, peer, agent, trace });
    await this.redeemer.consume(database, invitation, { session: session.session, assurance: 1, trace });
    const ticket = await this.tickets.issue(database, session.session, target, AuthTransaction.start(body.authorization));
    return { status: 201, headers: session.headers, result: { kind: 'session', ticket: ticket.ticket, returnTarget: this.returns.issue(target).proof } };
  }
  private code(challenge: string, code: string): string {
    return createHmac('sha256', this.sessionKey).update(`${challenge}:${code}`).digest('hex');
  }
}

function targetOf(value: unknown): 'console' | 'storefront' {
  if (value !== 'console' && value !== 'storefront') throw new Error('AUTH_RETURN_TARGET_INVALID');
  return value;
}
