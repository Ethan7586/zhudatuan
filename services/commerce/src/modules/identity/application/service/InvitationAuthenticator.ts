import type { ReadTransactionContext, WriteTransactionContext } from '../../../../foundation/persistence/TransactionContext';
import { createHash, createHmac, randomBytes, randomInt, randomUUID } from 'node:crypto';

import type { OperationRequest } from '../../../../foundation/application/OperationRequest';
import type { InvitationAccessPort } from '../../../access/public';
import type { CipherEnvelope, KmsClient } from '../../../../foundation/infrastructure/KmsClient';
import type { InvitationRepository } from '../port/InvitationRepository';
import type { InvitationHashPort } from '../port/InvitationSecurity';
import type { ReturnTargetPort } from '../port/ReturnTargetPort';
import type { SessionIssuer } from '../port/SessionIssuer';
import type { AuthTicketPort } from '../port/AuthTicketPort';
import type { FederationProtector } from '../../domain/service/FederationProtector';
import type { AuthenticationBody, AuthenticationReply } from './AuthenticationStrategy';
import { AuthTransaction } from '../../domain/model/AuthTransaction';
import type { IdentityMemberPort, InvitationMemberPort } from '../../../member/public';
import type { InvitationGuard } from '../service/InvitationGuard';
import { DomainError } from '../../../../foundation/domain/DomainError';
import type { InvitationRedeemer } from '../service/InvitationRedeemer';
import type { SessionCookiePort } from '../port/SessionCookiePort';
import type { ChallengePort } from '../port/ChallengePort';
import type { InvitationFailure } from '../service/InvitationFailure';
import type { InvitationLookup } from '../service/InvitationLookup';
import type { Invitation } from '../../domain/model/Invitation';
import { returnDestination } from './ReturnDestination';

type InvitationAuthenticationBody = Extract<AuthenticationBody, Readonly<{ method: 'invitation' }>>;

export interface LoadedInvitationAuthentication {
  readonly invitation: Invitation;
  readonly target: 'console' | 'storefront';
  readonly principal: string | null;
  readonly mobileCiphertext: string | null;
}

interface PreparedInvitationProof {
  readonly challenge: string;
  readonly code: string;
  readonly codeEnvelope: CipherEnvelope;
  readonly destinationEnvelope: CipherEnvelope;
}

export interface PreparedInvitationAuthentication {
  readonly loaded: LoadedInvitationAuthentication;
  readonly token: string;
  readonly claim: string;
  readonly proof?: PreparedInvitationProof;
}

export class InvitationAuthenticator {
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

  async load(request: OperationRequest, database: ReadTransactionContext, body: AuthenticationBody): Promise<LoadedInvitationAuthentication> {
    const invitationBody = requireInvitation(body);
    const target = targetOf(invitationBody.target);
    const invitation = await this.lookup.find(database, invitationBody.code, target);
    let principal = invitation.state.principal;
    if (invitation.requiresEnrollment() && invitation.state.membership) {
      const member = await this.access.pending(database, invitation.state.membership);
      principal = (await this.invited.pending(database, member)).principal;
    }
    let mobileCiphertext: string | null = null;
    if (invitation.requiresProof()) {
      const recipient = invitation.state.recipientHash;
      if (!principal || !recipient) throw new DomainError('INVITATION_INVALID');
      mobileCiphertext = (await this.members.securityProfile(database, principal)).mobileCiphertext;
      if (!mobileCiphertext) throw new DomainError('PROOF_REQUIRED');
    }
    return Object.freeze({ invitation, target, principal, mobileCiphertext });
  }

  async prepare(request: OperationRequest, loaded: LoadedInvitationAuthentication): Promise<PreparedInvitationAuthentication> {
    await this.guard.assert(request, loaded.target);
    await this.guard.assertRecipient(request, loaded.target, loaded.invitation.state.recipientHash);
    const token = randomBytes(48).toString('base64url');
    const claim = randomUUID();
    if (!loaded.invitation.requiresProof()) return Object.freeze({ loaded, token, claim });

    const principal = loaded.principal;
    const recipient = loaded.invitation.state.recipientHash;
    if (!principal || !recipient || !loaded.mobileCiphertext) throw new DomainError('INVITATION_INVALID');
    const destination = await this.kms.decrypt('pii', 'identity/mobile', loaded.mobileCiphertext, { principal });
    if (!this.hasher.matchesRecipient(destination, recipient)) throw new DomainError('INVITATION_INVALID');
    const challenge = `challenge:${randomUUID()}`;
    const code = String(randomInt(0, 1_000_000)).padStart(6, '0');
    const purpose = 'invitation_login';
    const [codeEnvelope, destinationEnvelope] = await Promise.all([this.kms.encrypt('pii', 'identity/challenge', code, { challenge, purpose }), this.kms.encrypt('pii', 'identity/destination', destination, { challenge, purpose })]);
    return Object.freeze({ loaded, token, claim, proof: Object.freeze({ challenge, code, codeEnvelope, destinationEnvelope }) });
  }

  async commit(request: OperationRequest, database: WriteTransactionContext, body: AuthenticationBody, prepared: PreparedInvitationAuthentication): Promise<AuthenticationReply> {
    const invitationBody = requireInvitation(body);
    const { loaded } = prepared;
    const destination = returnDestination(this.returns, loaded.target, invitationBody.returnTarget);
    const invitation = await this.lookup.lock(database, invitationBody.code, loaded.target);
    if (invitation.state.id !== loaded.invitation.state.id || invitation.state.version !== loaded.invitation.state.version) {
      throw new DomainError('INVITATION_INVALID');
    }
    const peer = request.input.headers['x-peer-address'] ?? 'unknown';
    const agent = request.input.headers['user-agent'] ?? 'unknown';
    const device = request.input.headers['x-device-id'] ?? 'browser';
    const trace = request.input.headers['x-trace-id'] ?? request.input.idempotency!;

    if (invitation.requiresEnrollment()) {
      await this.repository.reserve(database, invitation, {
        claim: prepared.claim,
        preauth: createHash('sha256').update(prepared.token).digest(),
        browser: this.protector.browser(peer, agent, device),
        device: this.protector.device(device),
        recipient: invitation.state.recipientHash,
        principal: loaded.principal,
        proof: 'otp',
      });
      return {
        status: 202,
        headers: Object.freeze({ 'set-cookie': this.cookies.preauth(prepared.token) }),
        result: { kind: 'enrollment', enrollment: { id: prepared.claim, expiresAt: new Date(Date.now() + 300_000).toISOString(), target: 'storefront' } },
      };
    }

    if (invitation.requiresProof()) {
      const principal = loaded.principal;
      const recipient = invitation.state.recipientHash;
      const proof = prepared.proof;
      if (!principal || !recipient || !proof) throw new DomainError('INVITATION_INVALID');
      await this.repository.reserve(database, invitation, {
        claim: prepared.claim,
        preauth: createHash('sha256').update(prepared.token).digest(),
        browser: this.protector.browser(peer, agent, device),
        device: this.protector.device(device),
        recipient,
        principal,
        proof: 'otp',
      });
      const issued = await this.challenges.issue(database, {
        id: proof.challenge,
        principal,
        purpose: 'invitation_login',
        destinationHash: recipient.toString('hex'),
        codeHash: this.code(proof.challenge, proof.code),
        codeCiphertext: proof.codeEnvelope.ciphertext,
        codeKeyVersion: proof.codeEnvelope.keyVersion,
        destinationCiphertext: proof.destinationEnvelope.ciphertext,
        destinationKeyVersion: proof.destinationEnvelope.keyVersion,
        scope: invitation.state.organization,
        ttlMinutes: 5,
        queueDelivery: true,
      });
      return {
        status: 202,
        headers: Object.freeze({ 'set-cookie': this.cookies.preauth(prepared.token) }),
        result: { kind: 'proofRequired', proof: { reference: proof.challenge, expiresAt: issued.expiresAt.toISOString(), method: 'otp', target: loaded.target } },
      };
    }

    if (!invitation.state.membership || !invitation.state.principal) throw new DomainError('INVITATION_INVALID');
    try {
      await this.redeemer.validate(database, invitation, loaded.target);
    } catch (cause) {
      return this.failures.reject(database, request, invitation.state.id, invitation.state.organization, cause, 'INVITATION_INVALID');
    }
    const session = await this.sessions.issue(database, {
      principal: invitation.state.principal,
      membership: invitation.state.membership,
      assurance: 1,
      target: loaded.target,
      device,
      peer,
      agent,
      trace,
    });
    await this.redeemer.consume(database, invitation, { session: session.session, assurance: 1, trace });
    const ticket = await this.tickets.issue(database, session.session, loaded.target, AuthTransaction.start(invitationBody.authorization));
    return { status: 201, headers: session.headers, result: { kind: 'session', ticket: ticket.ticket, returnTarget: destination.proof } };
  }

  private code(challenge: string, code: string): string {
    return createHmac('sha256', this.sessionKey).update(`${challenge}:${code}`).digest('hex');
  }
}

function requireInvitation(body: AuthenticationBody): InvitationAuthenticationBody {
  if (body.method !== 'invitation') throw new Error('AUTHENTICATION_METHOD_MISMATCH');
  return body;
}

function targetOf(value: unknown): 'console' | 'storefront' {
  if (value !== 'console' && value !== 'storefront') throw new Error('AUTH_RETURN_TARGET_INVALID');
  return value;
}
