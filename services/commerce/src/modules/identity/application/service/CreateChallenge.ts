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
import { canonicalIdentitySubject, canonicalMobile } from '../../domain/value/IdentitySubject';
import { assertPublicRisk } from '../service/PublicRisk';

interface PreparedChallenge {
  readonly id: string;
  readonly code: string;
  readonly purpose: 'login' | 'password_reset' | 'phone_change' | 'enrollment';
  readonly destination: string;
  readonly destinationHash: string;
  readonly device: string;
  readonly peer: string;
  readonly envelope: CipherEnvelope;
  readonly recipient: CipherEnvelope;
  readonly principal: string | null;
  readonly queueDelivery: boolean;
  readonly scope: string;
}

interface LoadedChallenge {
  readonly principal: string | null;
  readonly mobileCiphertext: string | null;
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
    private readonly members: IdentityMemberPort
  ) {}
  lifecycle(): OperationLifecycle<PreparedChallenge, LoadedChallenge> {
    return operationLifecycle({
      load: async (request, database) => {
        const { purpose, destinationHash } = challengeInput(request, this.invitationHash, (value) => this.digest(value));
        if (purpose === 'enrollment') return Object.freeze({ principal: null, mobileCiphertext: null });
        const principal = await this.credentials.principalForSubject(database, destinationHash);
        const profile = await this.members.securityProfile(database, principal ?? 'principal:unresolved');
        return Object.freeze({ principal, mobileCiphertext: profile.mobileCiphertext });
      },
      prepare: async (request, loaded) => {
        const { purpose, destination, destinationHash } = challengeInput(request, this.invitationHash, (value) => this.digest(value));
        const prepared = await this.prepareChallenge(request, purpose, destination, destinationHash, loaded.principal, 'identity', false);
        const requestedRecipient = prepared.recipient;
        let recipient = requestedRecipient;
        let queueDelivery = purpose === 'enrollment';
        if (purpose !== 'enrollment') {
          const bound = loaded.principal !== null && loaded.mobileCiphertext !== null;
          const source = bound
            ? await this.kms.decrypt('pii', 'identity/mobile', loaded.mobileCiphertext!, { principal: loaded.principal! })
            : await this.kms.decrypt('pii', 'identity/destination', requestedRecipient.ciphertext, { challenge: prepared.id, purpose });
          const mobile = optionalMobile(source);
          queueDelivery = loaded.principal !== null && mobile !== null;
          recipient = await this.kms.encrypt('pii', 'identity/destination', mobile ?? source, { challenge: prepared.id, purpose });
        }
        return { ...prepared, recipient, queueDelivery };
      },
      execute: async (request, database, value) => {
        let principal = value.principal;
        let scope = value.scope;
        if (value.purpose === 'enrollment') {
          const preauth = await this.preauth.resolve(request.input.headers, OperationCatalog.get('identity.enrollments.complete'));
          const invitation = await this.invitations.lockClaimed(requireWriteTransaction(database), preauth.reference, preauth.target);
          const claim = await this.invitations.claim(requireWriteTransaction(database), preauth.reference);
          if (
            !invitation.requiresEnrollment() ||
            claim.invitation !== invitation.state.id ||
            claim.target !== 'storefront' ||
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
    return Object.freeze({ id, code, purpose, destination, destinationHash, device, peer, envelope, recipient, principal, queueDelivery, scope });
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
    return { status: 202, body: { id: issued.id, purpose: issued.purpose, expires_at: issued.expiresAt.toISOString() } };
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
  const requested = textField(body, 'destination').trim();
  const destination = purpose === 'enrollment' ? canonicalMobile(requested) : canonicalIdentitySubject(requested);
  const destinationHash = purpose === 'enrollment' ? invitationHash.recipient(destination).toString('hex') : digest(destination);
  return Object.freeze({ purpose, destination, destinationHash });
}
function optionalMobile(value: string): string | null {
  try {
    return canonicalMobile(value);
  } catch {
    return null;
  }
}
function purposeOf(value: unknown): 'login' | 'password_reset' | 'enrollment' {
  if (value !== 'login' && value !== 'password_reset' && value !== 'enrollment') throw new DomainError('CHALLENGE_PURPOSE_INVALID');
  return value;
}
