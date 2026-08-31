import { DomainError } from '../../../../foundation/domain/DomainError';
import { createHmac, randomInt, randomUUID } from 'node:crypto';
import { OperationCatalog } from '@shop/contract';
import { RUNTIME_LIMITS } from '@shop/config/runtime';
import { operationLifecycle, reject, type OperationLifecycle } from '../../../../foundation/application/ModuleOperations';
import { bodyRecord, textField } from '../../../../foundation/interface/Validation';
import type { KmsClient, CipherEnvelope } from '../../../../foundation/infrastructure/KmsClient';
import type { RiskGate } from '../../../../foundation/security/RiskGate';
import { sessionAccess } from '../../../../foundation/security/OperationSecurityContext';
import type { PreauthResolver } from '../../../../foundation/security/PreauthResolver';
import type { ChallengePort } from '../port/ChallengePort';
import type { InvitationRepository } from '../port/InvitationRepository';
import type { InvitationHashPort } from '../port/InvitationSecurity';
import type { IdentityEventPort } from '../port/IdentityEventPort';
import type { CredentialRepository } from '../port/CredentialRepository';
import type { IdentityMemberPort } from '../../../member/public';
import { canonicalIdentitySubject, canonicalMobile } from '../../IdentitySubject';
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
    private readonly events: IdentityEventPort,
    private readonly credentials: CredentialRepository,
    private readonly members: IdentityMemberPort
  ) {}
  lifecycle(): OperationLifecycle<PreparedChallenge> {
    return operationLifecycle({
      prepare: async (request) => {
        const body = bodyRecord(request);
        const purpose = purposeOf(body.purpose);
        const requested = textField(body, 'destination').trim();
        const destination = purpose === 'phone_change' || purpose === 'enrollment' ? canonicalMobile(requested) : canonicalIdentitySubject(requested);
        const destinationHash = purpose === 'enrollment' ? this.invitationHash.recipient(destination).toString('hex') : this.digest(destination);
        const device = this.digest(request.input.headers['x-device-id'] ?? 'unknown');
        const peer = this.digest(request.input.headers['x-peer-address'] ?? 'unknown');
        await assertPublicRisk(this.risk, request, destinationHash, device);
        const id = `challenge:${randomUUID()}`;
        const code = String(randomInt(0, 1_000_000)).padStart(6, '0');
        const [envelope, recipient] = await Promise.all([this.kms.encrypt('pii', 'identity/challenge', code, { challenge: id, purpose }), this.kms.encrypt('pii', 'identity/destination', destination, { challenge: id, purpose })]);
        return { id, code, purpose, destination, destinationHash, device, peer, envelope, recipient };
      },
      execute: async (request, database, value) => {
        const access = sessionAccess(request.security);
        let scope = access?.scope.id ?? 'identity';
        if (value.purpose === 'phone_change' && !access) reject('AUTHENTICATION_REQUIRED');
        await this.challenges.throttle(database, [
          [value.destinationHash, value.purpose],
          [value.peer, `network:${value.purpose}`],
          [value.device, `device:${value.purpose}`],
        ]);
        let principal = access?.actor.id ?? null;
        let recipient = value.recipient;
        let queueDelivery = value.purpose === 'phone_change' || value.purpose === 'enrollment';
        if (value.purpose === 'enrollment') {
          const preauth = await this.preauth.resolve(request.input.headers, OperationCatalog.get('identity.enrollments.complete'));
          const invitation = await this.invitations.claimed(database, preauth.reference, preauth.target, true);
          const claim = await this.invitations.claim(database, preauth.reference);
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
        } else if (value.purpose !== 'phone_change') {
          principal = await this.credentials.principalForSubject(database, value.destinationHash);
          const profile = await this.members.securityProfile(database, principal ?? 'principal:unresolved');
          const bound = principal !== null && profile.mobileCiphertext !== null;
          const source = bound
            ? await this.kms.decrypt('pii', 'identity/mobile', profile.mobileCiphertext!, { principal: principal! })
            : await this.kms.decrypt('pii', 'identity/destination', value.recipient.ciphertext, { challenge: value.id, purpose: value.purpose });
          const mobile = optionalMobile(source);
          queueDelivery = principal !== null && mobile !== null;
          recipient = await this.kms.encrypt('pii', 'identity/destination', mobile ?? source, { challenge: value.id, purpose: value.purpose });
        }
        const issued = await this.challenges.issue(database, {
          id: value.id,
          principal,
          purpose: value.purpose,
          destinationHash: value.destinationHash,
          codeHash: this.code(value.id, value.code),
          codeCiphertext: value.envelope.ciphertext,
          codeKeyVersion: value.envelope.keyVersion,
          destinationCiphertext: recipient.ciphertext,
          destinationKeyVersion: recipient.keyVersion,
          scope,
          ttlMinutes: RUNTIME_LIMITS.authentication.otp.validMinutes,
          queueDelivery,
        });
        await this.events.publish(database, 'identity.challenge.started', 'challenge', value.id, scope, request.input.idempotency!, { challenge: value.id, destination: value.destinationHash, purpose: value.purpose });
        return { status: 202, body: { id: issued.id, purpose: issued.purpose, expires_at: issued.expiresAt.toISOString() } };
      },
    });
  }
  private digest(value: string): string {
    return createHmac('sha256', this.identityKey).update(value.trim().toLowerCase()).digest('hex');
  }
  private code(id: string, value: string): string {
    return createHmac('sha256', this.sessionKey).update(`${id}:${value}`).digest('hex');
  }
}
function optionalMobile(value: string): string | null {
  try {
    return canonicalMobile(value);
  } catch {
    return null;
  }
}
function purposeOf(value: unknown): 'login' | 'password_reset' | 'phone_change' | 'enrollment' {
  if (value !== 'login' && value !== 'password_reset' && value !== 'phone_change' && value !== 'enrollment') throw new DomainError('CHALLENGE_PURPOSE_INVALID');
  return value;
}
