import { identityLifecycle as operationLifecycle, type IdentityLifecycle as OperationLifecycle } from '../model/IdentityAction';
import { requireWriteTransaction } from '../../../../foundation/persistence/TransactionContext';
import { DomainError } from '../../../../foundation/domain/DomainError';
import { createHmac, randomInt, randomUUID } from 'node:crypto';
import { OperationCatalog } from '@shop/contract';
import { RUNTIME_LIMITS } from '@shop/config/runtime';

import { reject } from '../../../../foundation/application/OperationRejection';
import type { OperationRequest } from '../../../../foundation/application/OperationRequest';
import { bodyRecord, textField } from '../../../../foundation/interface/Validation';
import type { KmsClient, CipherEnvelope } from '../../../../foundation/infrastructure/KmsClient';
import type { RiskGate } from '../../../../foundation/security/RiskGate';
import { sessionAccess } from '../../../../foundation/security/OperationSecurityContext';
import type { PreauthResolver } from '../../../../foundation/security/PreauthResolver';
import type { ChallengePort } from '../port/ChallengePort';
import type { InvitationRepository } from '../port/InvitationRepository';
import type { InvitationHashPort } from '../port/InvitationSecurity';
import type { IdentityEventRepository } from '../port/IdentityEventRepository';
import type { CredentialRepository } from '../port/CredentialRepository';
import type { IdentityMemberPort } from '../../../member/public';
import type { InvitationMemberPort } from '../../../member/public';
import type { InvitationAccessPort } from '../../../access/public';
import { canonicalIdentitySubject, canonicalMobile } from '../../domain/value/IdentitySubject';
import { assertPublicRisk } from '../service/PublicRisk';

interface PreparedChallenge {
  readonly id: string;
  readonly code: string;
  readonly purpose: 'login' | 'password_reset' | 'phone_change' | 'enrollment' | 'enrollment_campaign';
  readonly destination: string;
  readonly destinationHash: string;
  readonly device: string;
  readonly peer: string;
  readonly envelope: CipherEnvelope;
  readonly recipient: CipherEnvelope;
  readonly principal: string | null;
  readonly queueDelivery: boolean;
  readonly scope: string;
  readonly enrollment: string | null;
}

interface LoadedChallenge {
  readonly principal: string | null;
  readonly mobileCiphertext: string | null;
  readonly enrollment: string | null;
  readonly invitation: string | null;
  readonly recipientHash: string | null;
  readonly scope: string;
  readonly mode: 'bound' | 'campaign' | null;
}

export class CreateChallenge {
  constructor(
    private readonly kms: KmsClient,
    private readonly risk: RiskGate,
    private readonly challenges: ChallengePort,
    private readonly identityKey: string,
    private readonly sessionKey: string,
    private readonly preauth: PreauthResolver,
    private readonly invitations: InvitationRepository,
    private readonly invitationHash: InvitationHashPort,
    private readonly events: IdentityEventRepository,
    private readonly credentials: CredentialRepository,
    private readonly members: IdentityMemberPort,
    private readonly invitationAccess: InvitationAccessPort,
    private readonly invitationMembers: InvitationMemberPort
  ) {}
  lifecycle(): OperationLifecycle<PreparedChallenge, LoadedChallenge> {
    return operationLifecycle({
      load: async (request, database) => {
        const input = challengeInput(request, this.invitationHash, (value) => this.digest(value));
        if (input.enrollmentId) {
          const preauth = await this.preauth.resolve(request.input.headers, OperationCatalog.get('identity.enrollments.complete'));
          if (preauth.reference !== input.enrollmentId || preauth.target !== 'storefront') throw new DomainError('PREAUTH_REQUIRED');
          const invitation = await this.invitations.claimed(database, preauth.reference, 'storefront');
          if (!invitation.requiresEnrollment()) throw new DomainError('INVITATION_INVALID');
          if (input.purpose === 'enrollment_campaign') {
            if (invitation.state.kind !== 'campaign') throw new DomainError('INVITATION_INVALID');
            return Object.freeze({ principal: null, mobileCiphertext: null, enrollment: preauth.reference, invitation: invitation.state.id, recipientHash: null, scope: invitation.state.organization, mode: 'campaign' as const });
          }
          if (invitation.state.kind !== 'enrollment' || !invitation.state.membership || !invitation.state.recipientHash) throw new DomainError('INVITATION_INVALID');
          const pending = await this.invitationMembers.pending(database, await this.invitationAccess.pending(database, invitation.state.membership));
          if (preauth.principal !== pending.principal || !pending.mobileCiphertext) throw new DomainError('INVITATION_INVALID');
          return Object.freeze({ principal: pending.principal, mobileCiphertext: pending.mobileCiphertext, enrollment: preauth.reference, invitation: invitation.state.id, recipientHash: invitation.state.recipientHash.toString('hex'), scope: invitation.state.organization, mode: 'bound' as const });
        }
        const destinationHash = input.destinationHash!;
        const principal = await this.credentials.principalForSubject(database, destinationHash);
        const profile = await this.members.securityProfile(database, principal ?? 'principal:unresolved');
        return Object.freeze({ principal, mobileCiphertext: profile.mobileCiphertext, enrollment: null, invitation: null, recipientHash: null, scope: 'identity', mode: null });
      },
      prepare: async (request, loaded) => {
        const input = challengeInput(request, this.invitationHash, (value) => this.digest(value));
        let destination = input.destination;
        let destinationHash = input.destinationHash;
        if (loaded.mode === 'bound') {
          if (!loaded.principal || !loaded.mobileCiphertext || !loaded.recipientHash) throw new DomainError('INVITATION_INVALID');
          destination = canonicalMobile(await this.kms.decrypt('pii', 'identity/mobile', loaded.mobileCiphertext, { principal: loaded.principal }));
          destinationHash = this.invitationHash.recipient(destination).toString('hex');
          if (destinationHash !== loaded.recipientHash) throw new DomainError('INVITATION_INVALID');
        }
        if (!destination || !destinationHash) throw new DomainError('VALIDATION_FAILED');
        const prepared = await this.prepareChallenge(request, input.purpose, destination, destinationHash, loaded.principal, loaded.scope, loaded.mode !== null);
        const requestedRecipient = prepared.recipient;
        let recipient = requestedRecipient;
        let queueDelivery = loaded.mode !== null;
        if (loaded.mode === null) {
          const bound = loaded.principal !== null && loaded.mobileCiphertext !== null;
          const source = bound
            ? await this.kms.decrypt('pii', 'identity/mobile', loaded.mobileCiphertext!, { principal: loaded.principal! })
            : await this.kms.decrypt('pii', 'identity/destination', requestedRecipient.ciphertext, { challenge: prepared.id, purpose: input.purpose });
          const mobile = optionalMobile(source);
          queueDelivery = loaded.principal !== null && mobile !== null;
          recipient = await this.kms.encrypt('pii', 'identity/destination', mobile ?? source, { challenge: prepared.id, purpose: input.purpose });
        }
        return { ...prepared, recipient, queueDelivery, enrollment: loaded.enrollment };
      },
      execute: async (request, database, value) => {
        let principal = value.principal;
        let scope = value.scope;
        if (value.enrollment) {
          const preauth = await this.preauth.resolve(request.input.headers, OperationCatalog.get('identity.enrollments.complete'));
          if (preauth.reference !== value.enrollment || preauth.target !== 'storefront') throw new DomainError('PREAUTH_REQUIRED');
          const invitation = await this.invitations.lockClaimed(requireWriteTransaction(database), preauth.reference, preauth.target);
          const claim = await this.invitations.claim(requireWriteTransaction(database), preauth.reference);
          if (
            !invitation.requiresEnrollment() ||
            claim.invitation !== invitation.state.id ||
            claim.target !== 'storefront' ||
            claim.state !== 'reserved' ||
            (invitation.state.kind === 'campaign') !== (value.purpose === 'enrollment_campaign') ||
            (invitation.state.recipientHash && !this.invitationHash.matchesRecipient(value.destination, invitation.state.recipientHash))
          ) {
            throw new DomainError('INVITATION_INVALID');
          }
          await this.invitations.bindRecipient(database, claim.id, Buffer.from(value.destinationHash, 'hex'));
          principal = preauth.principal;
          scope = invitation.state.organization;
        }
        return this.issue(request, database, { ...value, principal, scope });
      },
    });
  }

  mobile(): OperationLifecycle<PreparedChallenge> {
    return operationLifecycle({
      prepare: async (request) => {
        const access = sessionAccess(request.security);
        if (!access) reject('AUTHENTICATION_REQUIRED');
        const destination = canonicalMobile(textField(bodyRecord(request.input), 'destination', 32));
        return this.prepareChallenge(request, 'phone_change', destination, this.digest(destination), access.actor.id, access.scope.id, true);
      },
      execute: async (request, database, value) => this.issue(request, database, value),
    });
  }

  private async prepareChallenge(request: OperationRequest, purpose: PreparedChallenge['purpose'], destination: string, destinationHash: string, principal: string | null, scope: string, queueDelivery: boolean): Promise<PreparedChallenge> {
    const device = this.digest(request.input.headers['x-device-id'] ?? 'unknown');
    const peer = this.digest(request.input.headers['x-peer-address'] ?? 'unknown');
    await assertPublicRisk(this.risk, request, destinationHash, device);
    const id = `challenge:${randomUUID()}`;
    const code = String(randomInt(0, 1_000_000)).padStart(6, '0');
    const [envelope, recipient] = await Promise.all([this.kms.encrypt('pii', 'identity/challenge', code, { challenge: id, purpose }), this.kms.encrypt('pii', 'identity/destination', destination, { challenge: id, purpose })]);
    return Object.freeze({ id, code, purpose, destination, destinationHash, device, peer, envelope, recipient, principal, queueDelivery, scope, enrollment: null });
  }

  private async issue(request: OperationRequest, database: Parameters<OperationLifecycle<PreparedChallenge>['execute']>[1], value: PreparedChallenge) {
    await this.challenges.throttle(requireWriteTransaction(database), [
      [value.destinationHash, value.purpose],
      [value.peer, `network:${value.purpose}`],
      [value.device, `device:${value.purpose}`],
    ]);
    const issued = await this.challenges.issue(requireWriteTransaction(database), {
      id: value.id,
      principal: value.principal,
      purpose: value.purpose,
      destinationHash: value.destinationHash,
      codeHash: this.code(value.id, value.code),
      codeCiphertext: value.envelope.ciphertext,
      codeKeyVersion: value.envelope.keyVersion,
      destinationCiphertext: value.recipient.ciphertext,
      destinationKeyVersion: value.recipient.keyVersion,
      scope: value.scope,
      ttlMinutes: RUNTIME_LIMITS.authentication.otp.validMinutes,
      queueDelivery: value.queueDelivery,
    });
    await this.events.publish(database, 'identity.challenge.started', 'challenge', value.id, value.scope, request.input.idempotency!, {
      challenge: value.id,
      destination: value.destinationHash,
      purpose: value.purpose,
    });
    const retryAt = new Date(issued.expiresAt.getTime() - (RUNTIME_LIMITS.authentication.otp.validMinutes * 60 - RUNTIME_LIMITS.authentication.otp.resendSeconds) * 1_000);
    return { status: 202, body: { id: issued.id, purpose: issued.purpose, expires_at: issued.expiresAt.toISOString(), retry_at: retryAt.toISOString() } };
  }
  private digest(value: string): string {
    return createHmac('sha256', this.identityKey).update(value.trim().toLowerCase()).digest('hex');
  }
  private code(id: string, value: string): string {
    return createHmac('sha256', this.sessionKey).update(`${id}:${value}`).digest('hex');
  }
}

function challengeInput(request: OperationRequest, invitationHash: InvitationHashPort, digest: (value: string) => string) {
  const body = bodyRecord(request.input);
  const purpose = purposeOf(body.purpose);
  if (purpose === 'enrollment' || purpose === 'enrollment_campaign') {
    const enrollmentId = textField(body, 'enrollmentId', 128);
    if (purpose === 'enrollment') return Object.freeze({ purpose, enrollmentId, destination: null, destinationHash: null });
    const destination = canonicalMobile(textField(body, 'destination', 32));
    return Object.freeze({ purpose, enrollmentId, destination, destinationHash: invitationHash.recipient(destination).toString('hex') });
  }
  const destination = canonicalIdentitySubject(textField(body, 'destination').trim());
  return Object.freeze({ purpose, enrollmentId: null, destination, destinationHash: digest(destination) });
}
function optionalMobile(value: string): string | null {
  try {
    return canonicalMobile(value);
  } catch {
    return null;
  }
}
function purposeOf(value: unknown): 'login' | 'password_reset' | 'enrollment' | 'enrollment_campaign' {
  if (value !== 'login' && value !== 'password_reset' && value !== 'enrollment' && value !== 'enrollment_campaign') throw new DomainError('CHALLENGE_PURPOSE_INVALID');
  return value;
}
