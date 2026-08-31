import { createHmac } from 'node:crypto';
import { operationLifecycle, reject, requireAccess, type OperationAction, type OperationLifecycle } from '../../../../foundation/application/ModuleOperations';
import { bodyRecord, textField } from '../../../../foundation/interface/Validation';
import type { KmsClient, CipherEnvelope } from '../../../../foundation/infrastructure/KmsClient';
import type { RiskGate } from '../../../../foundation/security/RiskGate';
import type { IdentityMemberPort } from '../../../member/public';
import type { ChallengePort } from '../port/ChallengePort';
import type { PasswordPolicy } from '../../domain/policy/PasswordPolicy';
import { canonicalMobile } from '../../IdentitySubject';
import { assertPublicRisk } from '../service/PublicRisk';
import type { AssuranceRepository } from '../port/AssuranceRepository';
import type { CredentialRepository } from '../port/CredentialRepository';
import type { SessionRepository } from '../port/SessionRepository';
import type { IdentityEventPort } from '../port/IdentityEventPort';

interface PasswordChange {
  readonly actor: ReturnType<typeof requireAccess>;
  readonly current: string;
  readonly hash: string;
}
interface PasswordReset {
  readonly body: Readonly<Record<string, unknown>>;
  readonly challenge: string;
  readonly hash: string;
}
interface MobileChange {
  readonly actor: ReturnType<typeof requireAccess>;
  readonly body: Readonly<Record<string, unknown>>;
  readonly mobile: string;
  readonly envelope: CipherEnvelope;
}

export class ManageCredential {
  constructor(
    private readonly passwords: PasswordPolicy,
    private readonly challenges: ChallengePort,
    private readonly members: IdentityMemberPort,
    private readonly kms: KmsClient,
    private readonly risk: RiskGate,
    private readonly identityKey: string,
    private readonly sessionKey: string,
    private readonly credentials: CredentialRepository,
    private readonly assurances: AssuranceRepository,
    private readonly sessions: SessionRepository,
    private readonly events: IdentityEventPort
  ) {}

  change(): OperationLifecycle<PasswordChange> {
    return operationLifecycle({
      prepare: async (request) => {
        const body = bodyRecord(request);
        return { actor: requireAccess(request), current: textField(body, 'currentPassword', 128), hash: await this.passwords.hash(textField(body, 'newPassword', 128)) };
      },
      execute: async (_request, database, value) => {
        const credential = await this.credentials.password(database, value.actor.actor.id, true);
        if (!credential || !(await this.passwords.verify(value.current, credential.secretHash))) reject('CREDENTIAL_INVALID');
        const result = await this.credentials.changePassword(database, value.actor.actor.id, credential.id, value.hash, value.actor.actor.session);
        return { status: 200, body: result };
      },
    });
  }

  verify(): OperationAction {
    return async (request, database) => {
      const actor = requireAccess(request);
      const credential = await this.credentials.password(database, actor.actor.id, false);
      if (!(await this.passwords.verify(textField(bodyRecord(request), 'password', 128), credential?.secretHash ?? null))) reject('CREDENTIAL_INVALID');
      const verifiedAt = new Date().toISOString();
      await this.assurances.record(database, { principal: actor.actor.id, method: 'password', level: 2, evidenceHash: this.digest(actor.actor.session), expiresIn: '10minutes' });
      if (!(await this.sessions.elevate(database, actor.actor.id, actor.actor.session, 2))) reject('AUTHENTICATION_REQUIRED');
      return { status: 200, body: { verified: true, verifiedAt } };
    };
  }

  reset(): OperationLifecycle<PasswordReset> {
    return operationLifecycle({
      prepare: async (request) => {
        const body = bodyRecord(request);
        const challenge = textField(body, 'challenge');
        await assertPublicRisk(this.risk, request, this.digest(challenge), this.digest(request.input.headers['x-device-id'] ?? 'unknown'));
        return { body, challenge, hash: await this.passwords.hash(textField(body, 'newPassword', 128)) };
      },
      execute: async (request, database, value) => {
        const consumed = await this.challenges.consume(database, value.challenge, textField(value.body, 'code'), (id, code) => this.code(id, code), undefined, { purpose: 'password_reset' });
        if (!consumed.principal_id) reject('CHALLENGE_PRINCIPAL_MISSING');
        const result = await this.credentials.resetPassword(database, consumed.principal_id, value.hash);
        const member = await this.members.memberForPrincipal(database, consumed.principal_id);
        await this.events.publish(database, 'identity.member.reset', 'principal', consumed.principal_id, member, request.input.idempotency!, {
          memberId: member,
          credentialVersion: result.credentialVersion,
          reason: 'passwordreset',
        });
        return { status: 200, body: result };
      },
    });
  }

  mobile(): OperationLifecycle<MobileChange> {
    return operationLifecycle({
      prepare: async (request) => {
        const actor = requireAccess(request);
        const body = bodyRecord(request);
        const mobile = canonicalMobile(textField(body, 'mobile', 32));
        return { actor, body, mobile, envelope: await this.kms.encrypt('pii', 'identity/mobile', mobile, { principal: actor.actor.id }) };
      },
      execute: async (_request, database, value) => {
        await this.challenges.consume(database, textField(value.body, 'challenge'), textField(value.body, 'code'), (id, code) => this.code(id, code), value.actor.actor.id, {
          purpose: 'phone_change',
          destinationHash: this.digest(value.mobile),
        });
        await this.credentials.changeSubject(database, value.actor.actor.id, this.digest(value.mobile), value.actor.actor.session);
        const result = await this.members.changeMobile(database, value.actor.actor.id, value.envelope.ciphertext, value.envelope.fingerprint, mask(value.mobile));
        await this.assurances.expire(database, value.actor.actor.id, 'phone_otp');
        await this.assurances.record(database, { principal: value.actor.actor.id, method: 'phone_otp', level: 2, evidenceHash: this.digest(value.mobile), expiresIn: '365days' });
        return { status: 200, body: { memberId: String(result.id), displayName: String(result.display_name), mobileMasked: String(result.mobile_masked), version: Number(result.version) }, headers: { etag: `"${String(result.version)}"` } };
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
function mask(value: string): string {
  return `${value.slice(0, 3)}****${value.slice(-4)}`;
}
