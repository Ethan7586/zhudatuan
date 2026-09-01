import { identityLifecycle as operationLifecycle, type IdentityAction as OperationAction, type IdentityLifecycle as OperationLifecycle } from '../model/IdentityAction';
import { requireWriteTransaction } from '../../../../foundation/persistence/TransactionContext';
import { createHmac, randomInt, randomUUID } from 'node:crypto';
import type { OperationId } from '@shop/contract';

import { reject } from '../../../../foundation/application/OperationRejection';
import { requireAccess } from '../../../../foundation/application/OperationAccess';
import { bodyRecord, textField } from '../../../../foundation/interface/Validation';
import type { KmsClient, CipherEnvelope } from '../../../../foundation/infrastructure/KmsClient';
import type { IdentityMemberPort } from '../../../member/public';
import type { ChallengePort } from '../port/ChallengePort';
import type { AssuranceRepository } from '../port/AssuranceRepository';
import type { IdentityEventRepository } from '../port/IdentityEventRepository';
import type { SessionRepository } from '../port/SessionRepository';
import type { StepupRequestRepository } from '../port/StepupRequestRepository';
import type { ActionProofBinding, ActionProofChecker, ActionProofPort } from '../../../access/public';

interface PreparedStepup {
  readonly actor: ReturnType<typeof requireAccess>;
  readonly id: string;
  readonly code: string;
  readonly destination: string;
  readonly fingerprint: string;
  readonly envelope: CipherEnvelope;
  readonly recipient: CipherEnvelope;
  readonly binding: ActionProofBinding | null;
  readonly checker: ActionProofChecker;
}

interface LoadedStepup {
  readonly actor: ReturnType<typeof requireAccess>;
  readonly mobileCiphertext: string;
  readonly mobileFingerprint: string;
}

export class ManageStepup {
  constructor(
    private readonly members: IdentityMemberPort,
    private readonly kms: KmsClient,
    private readonly challenges: ChallengePort,
    private readonly identityKey: string,
    private readonly sessionKey: string,
    private readonly assurances: AssuranceRepository,
    private readonly sessions: SessionRepository,
    private readonly events: IdentityEventRepository,
    private readonly actionProofs: ActionProofPort,
    private readonly stepups: StepupRequestRepository
  ) {}
  start(): OperationLifecycle<PreparedStepup, LoadedStepup> {
    return operationLifecycle<PreparedStepup, LoadedStepup>({
      load: async (request, database) => {
        const actor = requireAccess(request);
        const profile = await this.members.securityProfile(database, actor.actor.id);
        if (!profile.mobileCiphertext || !profile.mobileFingerprint) throw new Error('STEP_UP_DESTINATION_MISSING');
        return { actor, mobileCiphertext: profile.mobileCiphertext, mobileFingerprint: profile.mobileFingerprint };
      },
      prepare: async (request, loaded) => {
        const id = `challenge:${randomUUID()}`;
        const code = String(randomInt(0, 1_000_000)).padStart(6, '0');
        const destination = await this.kms.decrypt('pii', 'identity/mobile', loaded.mobileCiphertext, { principal: loaded.actor.actor.id });
        const [envelope, recipient] = await Promise.all([
          this.kms.encrypt('pii', 'identity/challenge', code, { challenge: id, purpose: 'stepup' }),
          this.kms.encrypt('pii', 'identity/destination', destination, { challenge: id, purpose: 'stepup' }),
        ]);
        return {
          actor: loaded.actor,
          id,
          code,
          destination,
          fingerprint: loaded.mobileFingerprint,
          envelope,
          recipient,
          binding: actionBinding(bodyRecord(request.input)),
          checker: checker(loaded.actor),
        };
      },
      execute: async (request, database, value) => {
        const current = await this.members.securityProfile(database, value.actor.actor.id);
        if (current.mobileFingerprint !== value.fingerprint) reject('STEPUP_REQUIRED');
        const approval = value.binding ? await this.actionProofs.validate(database, value.binding, value.checker) : null;
        await this.challenges.throttle(requireWriteTransaction(database), [
          [this.digest(`${value.actor.actor.id}:${value.destination}`), 'stepup'],
          [this.digest(request.input.headers['x-peer-address'] ?? 'unknown'), 'network:stepup'],
          [this.digest(request.input.headers['x-device-id'] ?? 'unknown'), 'device:stepup'],
        ]);
        const started = await this.challenges.issue(requireWriteTransaction(database), {
          id: value.id,
          principal: value.actor.actor.id,
          purpose: 'stepup',
          destinationHash: this.digest(value.destination),
          codeHash: this.code(value.id, value.code),
          codeCiphertext: value.envelope.ciphertext,
          codeKeyVersion: value.envelope.keyVersion,
          destinationCiphertext: value.recipient.ciphertext,
          destinationKeyVersion: value.recipient.keyVersion,
          scope: value.actor.scope.id,
          ttlMinutes: 5,
          queueDelivery: true,
        });
        if (approval) await this.stepups.save(requireWriteTransaction(database), value.id, approval);
        await this.events.publish(database, 'identity.challenge.started', 'challenge', value.id, value.actor.scope.id, request.input.idempotency!, {
          challenge: value.id,
          purpose: 'stepup',
          ...(value.binding ? { operation: value.binding.operation } : {}),
        });
        return { status: 202, body: { id: started.id, purpose: started.purpose, expiresAt: started.expiresAt.toISOString(), actionBound: value.binding !== null } };
      },
    });
  }
  complete(): OperationAction {
    return async (request, database) => {
      const actor = requireAccess(request);
      const body = bodyRecord(request.input);
      const challenge = textField(body, 'challenge');
      await this.challenges.consume(requireWriteTransaction(database), challenge, textField(body, 'code'), (id, code) => this.code(id, code), actor.actor.id, { purpose: 'stepup' });
      await this.assurances.record(requireWriteTransaction(database), { principal: actor.actor.id, method: 'otp', level: 3, evidenceHash: this.digest(challenge), expiresIn: '15minutes' });
      if (!(await this.sessions.elevate(database, actor.actor.id, actor.actor.session, 3))) reject('AUTHENTICATION_REQUIRED');
      const binding = await this.stepups.consume(requireWriteTransaction(database), challenge, actor.actor.membership);
      const issued = binding ? await this.actionProofs.issue(requireWriteTransaction(database), binding, checker(actor)) : null;
      return { status: 200, body: { session: actor.actor.session, assurance: 3, ...(issued ?? {}) } };
    };
  }
  private digest(value: string): string {
    return createHmac('sha256', this.identityKey).update(value.trim().toLowerCase()).digest('hex');
  }
  private code(id: string, value: string): string {
    return createHmac('sha256', this.sessionKey).update(`${id}:${value}`).digest('hex');
  }
}

function checker(actor: ReturnType<typeof requireAccess>): ActionProofChecker {
  return Object.freeze({ membership: actor.actor.membership, target: actor.actor.target, accessVersion: actor.accessVersion });
}

function actionBinding(body: Readonly<Record<string, unknown>>): ActionProofBinding | null {
  if (body.action === undefined) return null;
  if (body.action === null || typeof body.action !== 'object' || Array.isArray(body.action)) reject('VALIDATION_FAILED', { field: 'action' });
  const action = body.action as Readonly<Record<string, unknown>>;
  const expected = action.expectedVersion === undefined || action.expectedVersion === null ? null : action.expectedVersion;
  if (expected !== null && (!Number.isSafeInteger(expected) || (expected as number) < 0)) reject('VALIDATION_FAILED', { field: 'expectedVersion' });
  return Object.freeze({
    operation: textField(action, 'operation') as OperationId,
    resource: textField(action, 'resource'),
    requestHash: textField(action, 'requestHash', 64),
    expectedVersion: expected as number | null,
    makerMembership: textField(action, 'makerMembership'),
  });
}
