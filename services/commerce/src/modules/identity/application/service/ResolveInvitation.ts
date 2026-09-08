import { createHash, createHmac, randomBytes, randomInt, randomUUID } from 'node:crypto';
import type { IdentityInvitationsResolveBody } from '@shop/contract';
import { RUNTIME_LIMITS } from '@shop/config/runtime';
import type { Telemetry } from '@shop/telemetry';

import type { ReadTransactionContext, WriteTransactionContext } from '../../../../platform/database/TransactionContext';
import type { OperationRequest, OperationResult } from '../../../../pipeline/OperationRequest';
import { bodyRecord } from '../../../../pipeline/Validation';
import { DomainError } from '../../../../platform/error/DomainError';
import type { KmsClient } from '../../../../pipeline/KmsPort';
import type { InvitationAccessPort } from '../../../access/public';
import type { IdentityRegistrationPort } from '../../../member/public';
import type { IdentityOrganizationPort } from '../../../organization/public/IdentityOrganizationPort';
import { AuthTransaction } from '../../domain/model/AuthTransaction';
import type { FederationProtector } from '../../domain/service/FederationProtector';
import type { AuthTicketPort } from '../port/AuthTicketPort';
import type { ChallengePort } from '../port/ChallengePort';
import type { InvitationRepository } from '../port/InvitationRepository';
import type { InvitationHashPort } from '../port/InvitationSecurity';
import type { RegistrationPolicyRepository } from '../port/RegistrationPolicyRepository';
import type { ReturnTargetPort } from '../port/ReturnTargetPort';
import type { SessionCookiePort } from '../port/SessionCookiePort';
import type { SessionIssuer } from '../port/SessionIssuer';
import type { InvitationFailure } from './InvitationFailure';
import type { InvitationGuard } from './InvitationGuard';
import type { InvitationLookup } from './InvitationLookup';
import type { InvitationRedeemer } from './InvitationRedeemer';
import { returnDestination } from './ReturnDestination';
import type { LoadedInvitationResolution, PreparedInvitationResolution } from './InvitationResolution';

export class ResolveInvitation {
  constructor(
    private readonly repository: InvitationRepository,
    private readonly access: InvitationAccessPort,
    private readonly invited: IdentityRegistrationPort,
    private readonly organizations: IdentityOrganizationPort,
    private readonly lookup: InvitationLookup,
    private readonly guard: InvitationGuard,
    private readonly protector: FederationProtector,
    private readonly kms: KmsClient,
    private readonly hasher: InvitationHashPort,
    private readonly sessionKey: string,
    private readonly sessions: SessionIssuer,
    private readonly tickets: AuthTicketPort,
    private readonly returns: ReturnTargetPort,
    private readonly cookies: SessionCookiePort,
    private readonly challenges: ChallengePort,
    private readonly redeemer: InvitationRedeemer,
    private readonly failures: InvitationFailure,
    private readonly registrations: RegistrationPolicyRepository,
    private readonly telemetry: Telemetry
  ) {}

  async load(request: OperationRequest, database: ReadTransactionContext): Promise<LoadedInvitationResolution> {
    const body = invitationInput(request);
    try {
      const invitation = await this.lookup.find(database, body.code, body.target);
      let principal = invitation.state.principal;
      let mobileCiphertext: string | null = null;
      if (invitation.state.kind === 'enrollment') {
        if (!invitation.state.membership) throw new DomainError('INVITATION_INVALID');
        const pending = await this.invited.pending(database, await this.access.pending(database, invitation.state.membership));
        principal = pending.principal;
        mobileCiphertext = pending.mobileCiphertext;
      } else if (invitation.requiresProof()) {
        if (!principal) throw new DomainError('INVITATION_INVALID');
        mobileCiphertext = (await this.invited.mobile(database, principal))?.ciphertext ?? null;
      }
      const [organization, policy] = await Promise.all([
        this.organizations.names(database, [invitation.state.organization]),
        invitation.state.policy ? this.registrations.read(database, invitation.state.policy, invitation.requiresEnrollment()) : Promise.resolve(null),
      ]);
      if (!organization[0] || (invitation.requiresEnrollment() && !policy)) throw new DomainError('INVITATION_STALE');
      return Object.freeze({ invitation, target: body.target, principal, mobileCiphertext, organizationName: organization[0].name, policy });
    } catch (cause) {
      this.recordFailure(request, cause);
      throw cause;
    }
  }

  async prepare(request: OperationRequest, loaded: LoadedInvitationResolution): Promise<PreparedInvitationResolution> {
    const body = invitationInput(request);
    try {
      const transaction = AuthTransaction.start(body.authorization);
      const destination = returnDestination(this.returns, loaded.target, body.returnTarget);
      await Promise.all([this.guard.assert(request, loaded.target), this.guard.assertRecipient(request, loaded.target, loaded.invitation.state.recipientHash)]);
      const peer = request.input.headers['x-peer-address'] ?? 'unknown';
      const agent = request.input.headers['user-agent'] ?? 'unknown';
      const deviceId = request.input.headers['x-device-id'] ?? 'browser';
      const prepared = {
        loaded,
        token: randomBytes(48).toString('base64url'),
        claim: randomUUID(),
        browser: this.protector.browser(peer, agent, deviceId),
        device: this.protector.device(deviceId),
        destination,
        authorization: Object.freeze({ transaction, stateHash: transaction.stateHash, nonceHash: transaction.nonceHash, challenge: transaction.challenge }),
      };
      if (!loaded.invitation.requiresProof()) return Object.freeze(prepared);
      const principal = loaded.principal;
      const recipient = loaded.invitation.state.recipientHash;
      if (!principal || !recipient || !loaded.mobileCiphertext) throw new DomainError('INVITATION_INVALID');
      const mobile = await this.kms.decrypt('pii', 'identity/mobile', loaded.mobileCiphertext, { principal });
      if (!this.hasher.matchesRecipient(mobile, recipient)) throw new DomainError('INVITATION_INVALID');
      const challenge = `challenge:${randomUUID()}`;
      const code = String(randomInt(0, 1_000_000)).padStart(6, '0');
      const purpose = 'invitation_login';
      const [codeEnvelope, destinationEnvelope] = await Promise.all([this.kms.encrypt('pii', 'identity/challenge', code, { challenge, purpose }), this.kms.encrypt('pii', 'identity/destination', mobile, { challenge, purpose })]);
      return Object.freeze({ ...prepared, proof: Object.freeze({ challenge, code, codeEnvelope, destinationEnvelope }) });
    } catch (cause) {
      this.recordFailure(request, cause);
      throw cause;
    }
  }

  async commit(request: OperationRequest, database: WriteTransactionContext, prepared: PreparedInvitationResolution): Promise<OperationResult> {
    const body = invitationInput(request);
    const loaded = prepared.loaded;
    const invitation = await this.lookup.lock(database, body.code, loaded.target);
    if (invitation.state.id !== loaded.invitation.state.id || invitation.state.version !== loaded.invitation.state.version) throw new DomainError('INVITATION_INVALID');
    await this.guard.assertRecipientWithin(database, request, loaded.target, invitation.state.recipientHash);
    try {
      if (invitation.state.kind === 'campaign') {
        await this.access.validateCampaign(database, {
          issuer: invitation.state.issuer,
          issuerAccessVersion: invitation.state.issuerAccessVersion,
          grantDigest: invitation.state.grantDigest,
          organization: invitation.state.organization,
          policy: invitation.state.policy,
          termsHash: invitation.state.termsHash,
          expiresAt: invitation.state.expiresAt,
        });
      } else await this.redeemer.validate(database, invitation, loaded.target);
    } catch (cause) {
      return this.failures.reject(database, request, invitation.state.id, invitation.state.organization, cause, 'INVITATION_INVALID');
    }

    const common = {
      claim: prepared.claim,
      preauth: createHash('sha256').update(prepared.token).digest(),
      browser: prepared.browser,
      device: prepared.device,
      recipient: invitation.state.recipientHash,
      principal: loaded.principal,
      proof: 'otp' as const,
      authorization: prepared.authorization,
      returnTarget: prepared.destination.proof,
    };
    if (invitation.requiresEnrollment()) {
      await this.repository.reserve(database, invitation, { ...common, state: 'reserved' });
      return {
        status: 200,
        headers: Object.freeze({ 'set-cookie': this.cookies.preauth(prepared.token) }),
        body: { kind: 'enrollment', enrollment: { id: prepared.claim, expiresAt: claimExpiry().toISOString(), target: 'storefront' } },
      };
    }
    if (invitation.requiresProof()) {
      const proof = prepared.proof;
      const principal = loaded.principal;
      const recipient = invitation.state.recipientHash;
      if (!proof || !principal || !recipient) throw new DomainError('INVITATION_INVALID');
      await this.repository.reserve(database, invitation, { ...common, state: 'proofpending' });
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
        ttlMinutes: RUNTIME_LIMITS.authentication.otp.validMinutes,
        queueDelivery: true,
      });
      const retryAt = new Date(issued.expiresAt.getTime() - (RUNTIME_LIMITS.authentication.otp.validMinutes * 60 - RUNTIME_LIMITS.authentication.otp.resendSeconds) * 1_000);
      return {
        status: 202,
        headers: Object.freeze({ 'set-cookie': this.cookies.preauth(prepared.token) }),
        body: {
          kind: 'proofRequired',
          proof: {
            reference: proof.challenge,
            purpose: 'invitation_login',
            expiresAt: issued.expiresAt.toISOString(),
            retryAt: retryAt.toISOString(),
            attemptsRemaining: RUNTIME_LIMITS.authentication.otp.maximumAttempts,
            method: 'otp',
            target: loaded.target,
          },
        },
      };
    }
    if (!invitation.state.membership || !invitation.state.principal) throw new DomainError('INVITATION_INVALID');
    const device = request.input.headers['x-device-id'] ?? 'browser';
    const peer = request.input.headers['x-peer-address'] ?? 'unknown';
    const agent = request.input.headers['user-agent'] ?? 'unknown';
    const trace = request.input.headers['x-trace-id'] ?? request.input.idempotency!;
    const claim = await this.repository.reserve(database, invitation, { ...common, state: 'reserved' });
    const session = await this.sessions.issue(database, { principal: invitation.state.principal, membership: invitation.state.membership, assurance: 1, target: loaded.target, device, peer, agent, trace });
    await this.redeemer.consume(database, invitation, { session: session.session, assurance: 1, trace, claim: { id: claim.id, version: claim.version } });
    const ticket = await this.tickets.issue(database, session.session, loaded.target, prepared.authorization.transaction);
    return { status: 201, headers: session.headers, body: { kind: 'session', ticket: ticket.ticket, returnTarget: prepared.destination.proof } };
  }

  finalize(request: OperationRequest, result: OperationResult): OperationResult {
    this.telemetry.metrics.count('identity_invitation_resolve_total', 1, { ...this.base(request), result: 'success' });
    return result;
  }

  discard(request: OperationRequest, _prepared: PreparedInvitationResolution, cause: unknown): Promise<void> {
    this.recordFailure(request, cause);
    return Promise.resolve();
  }

  private code(challenge: string, code: string): string {
    return createHmac('sha256', this.sessionKey).update(`${challenge}:${code}`).digest('hex');
  }

  private base(request: OperationRequest) {
    const trace = request.input.headers['x-trace-id'] ?? request.input.idempotency ?? request.input.publicActor ?? 'public:invitation';
    return { requestId: trace, traceId: trace, module: 'identity', operation: 'identity.invitations.resolve' } as const;
  }

  private recordFailure(request: OperationRequest, cause: unknown): void {
    const errorCode = cause instanceof DomainError ? cause.code : 'INVITATION_RESOLVE_FAILED';
    const base = this.base(request);
    this.telemetry.metrics.count('identity_invitation_resolve_total', 1, { ...base, result: 'failure', errorCode });
    this.telemetry.metrics.count('identity_invitation_failure_total', 1, { ...base, result: 'failure', errorCode });
  }
}

export type { LoadedInvitationResolution, PreparedInvitationResolution } from './InvitationResolution';

function invitationInput(request: OperationRequest): IdentityInvitationsResolveBody {
  return bodyRecord(request.input) as IdentityInvitationsResolveBody;
}

function claimExpiry(): Date {
  return new Date(Date.now() + RUNTIME_LIMITS.authentication.otp.validMinutes * 60_000);
}
