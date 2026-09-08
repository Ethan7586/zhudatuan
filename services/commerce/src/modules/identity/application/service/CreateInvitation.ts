import { randomUUID } from 'node:crypto';
import type { IdentityInvitationsCreateBody } from '@shop/contract';
import type { Telemetry } from '@shop/telemetry';
import { requireAccess } from '../../../../pipeline/OperationAccess';
import type { OperationRequest, OperationResult } from '../../../../pipeline/OperationRequest';
import { DomainError } from '../../../../platform/error/DomainError';
import type { KmsClient } from '../../../../pipeline/KmsPort';
import type { ReadTransactionContext, WriteTransactionContext } from '../../../../platform/database/TransactionContext';
import type { InvitationAccessPort } from '../../../access/public';
import type { IdentityRegistrationPort } from '../../../member/public';
import { InvitationPolicy } from '../../domain/policy/InvitationPolicy';
import { canonicalIdentitySubject } from '../../domain/value/IdentitySubject';
import { identityLifecycle, type IdentityLifecycle } from '../model/IdentityAction';
import type { EnrollmentRepository } from '../port/EnrollmentRepository';
import type { IdentityEventRepository } from '../port/IdentityEventRepository';
import type { InvitationRepository } from '../port/InvitationRepository';
import type { InvitationCodePort, InvitationHashPort } from '../port/InvitationSecurity';
import type { RegistrationPolicyRepository } from '../port/RegistrationPolicyRepository';
import { invitationExpiry, invitationReceipt, invitationText, type LoadedInvitation, type PreparedInvitation } from './InvitationCreation';
import { OneTimeInvitationCode, PrepareEmployeeInvitation } from './PrepareEmployeeInvitation';
import { publishInvitation, recordInvitation } from './InvitationObserver';
export class CreateInvitation {
  constructor(
    private readonly repository: InvitationRepository,
    private readonly access: InvitationAccessPort,
    private readonly members: IdentityRegistrationPort,
    private readonly enrollments: EnrollmentRepository,
    private readonly employee: PrepareEmployeeInvitation,
    private readonly kms: KmsClient,
    private readonly generator: InvitationCodePort,
    private readonly hasher: InvitationHashPort,
    private readonly registrations: RegistrationPolicyRepository,
    private readonly events: IdentityEventRepository,
    private readonly telemetry: Telemetry,
    private readonly policy = new InvitationPolicy()
  ) {}

  lifecycle(): IdentityLifecycle<PreparedInvitation, LoadedInvitation> {
    return identityLifecycle({
      load: (request, database) => this.load(request, database),
      prepare: (request, loaded) => this.prepare(request, loaded),
      execute: (request, database, prepared) => this.commit(request, database, prepared),
      finalize: (request, result, prepared) => {
        prepared.code.clear();
        recordInvitation(this.telemetry, request, prepared.kind, 'success');
        return Promise.resolve(result);
      },
      discard: (request, prepared, cause) => {
        prepared.code.clear();
        recordInvitation(this.telemetry, request, prepared.kind, 'failure', cause instanceof DomainError ? cause.code : 'INVITATION_CREATE_FAILED');
        return Promise.resolve();
      },
    });
  }

  private async load(request: OperationRequest, database: ReadTransactionContext): Promise<LoadedInvitation> {
    const body = request.input.body as IdentityInvitationsCreateBody;
    if (body.kind !== 'signin') return Object.freeze({ kind: 'none' });
    const actor = requireAccess(request);
    const expectedVersion = request.input.expectedVersion;
    if (expectedVersion === undefined) throw new DomainError('VERSION_CONFLICT');
    if (actor.assurance.level < 3) throw new DomainError('STEPUP_REQUIRED');
    const plan = await this.access.plan(database, {
      issuer: actor.membership.id,
      membership: body.membershipId,
      organization: null,
      target: body.target,
      kind: body.kind,
      expectedVersion,
      expiresAt: invitationExpiry(body.expiresAt),
      policy: null,
      termsHash: null,
    });
    if (!plan.principal) throw new DomainError('MEMBERSHIP_NOT_INVITED');
    const mobile = await this.members.mobile(database, plan.principal);
    if (!mobile) throw new DomainError('PROOF_REQUIRED');
    return Object.freeze({ kind: 'signin', principal: plan.principal, mobileCiphertext: mobile.ciphertext });
  }

  private async prepare(request: OperationRequest, loaded: LoadedInvitation): Promise<PreparedInvitation> {
    const body = request.input.body as IdentityInvitationsCreateBody;
    if (body.kind === 'enrollment') return this.employee.prepare(body);
    const expiresAt = invitationExpiry(body.expiresAt);
    const reason = invitationText(body.reason, 'reason', 4, 1000);
    const issued = this.generator.issue();
    let principal: string | null = null;
    let recipientHash: Buffer | null = null;
    if (body.kind === 'signin') {
      if (loaded.kind !== 'signin') throw new Error('INVITATION_SIGNIN_LOAD_REQUIRED');
      const mobile = await this.kms.decrypt('pii', 'identity/mobile', loaded.mobileCiphertext, { principal: loaded.principal });
      principal = loaded.principal;
      recipientHash = this.hasher.recipient(canonicalIdentitySubject(mobile));
    }
    const shared = {
      invitation: `invitation:${randomUUID()}`,
      token: this.hasher.current(issued),
      code: new OneTimeInvitationCode(issued.display()),
      expiresAt,
      reason,
      principal,
      recipientHash,
    };
    return body.kind === 'campaign' ? Object.freeze({ ...shared, kind: 'campaign' as const, body }) : Object.freeze({ ...shared, kind: 'signin' as const, body });
  }

  private async commit(request: OperationRequest, database: WriteTransactionContext, prepared: PreparedInvitation): Promise<OperationResult> {
    const actor = requireAccess(request);
    const expectedVersion = request.input.expectedVersion;
    if (expectedVersion === undefined) throw new DomainError('VERSION_CONFLICT');
    if (prepared.kind !== 'enrollment' && actor.assurance.level < 3) throw new DomainError('STEPUP_REQUIRED');
    const registration = prepared.kind === 'signin' ? null : await this.registrations.current(database);
    if (prepared.kind !== 'signin' && !registration) throw new Error('REGISTRATION_POLICY_MISSING');
    if (prepared.kind === 'enrollment') {
      await this.members.assertMobileAvailable(database, prepared.mobileFingerprint);
      await this.enrollments.createPendingPrincipal(database, { principal: prepared.principal, createdAt: prepared.createdAt });
      await this.members.createPending(database, {
        member: prepared.member,
        principal: prepared.principal,
        display: prepared.displayName,
        mobileCiphertext: prepared.mobileCiphertext,
        mobileFingerprint: prepared.mobileFingerprint,
        mobileMasked: prepared.mobileMasked,
      });
      const grant = await this.access.prepareEmployee(database, {
        membership: prepared.membership,
        member: prepared.member,
        principal: prepared.principal,
        organization: prepared.organization,
        employeeNo: prepared.employeeNo,
        department: prepared.department,
        issuer: actor.membership.id,
        issuerAccessVersion: expectedVersion,
        policy: registration!.id,
        termsHash: registration!.terms_hash,
        expiresAt: prepared.expiresAt,
      });
      this.policy.issue(
        {
          kind: prepared.kind,
          target: prepared.target,
          membership: prepared.membership,
          principal: null,
          recipientHash: prepared.recipientHash,
          maxUses: 1,
          assurance: 2,
          reason: prepared.reason,
          expiresAt: prepared.expiresAt,
        },
        prepared.createdAt
      );
      const row = await this.repository.create(database, {
        id: prepared.invitation,
        kind: prepared.kind,
        target: prepared.target,
        organization: prepared.organization,
        membership: prepared.membership,
        principal: null,
        recipientHash: prepared.recipientHash,
        token: prepared.token,
        issuer: actor.membership.id,
        issuerAccessVersion: expectedVersion,
        grantDigest: grant.grantDigest,
        assurance: 2,
        maxUses: 1,
        expiresAt: prepared.expiresAt,
        policy: registration!.id,
        termsHash: registration!.terms_hash,
        reason: prepared.reason,
      });
      await publishInvitation(this.events, database, request, prepared.invitation, prepared.organization, prepared.kind, prepared.target, prepared.membership);
      return invitationReceipt(row, prepared.code.reveal(), prepared.mobileMasked, { displayName: prepared.displayName, ...(prepared.employeeNo === null ? {} : { employeeNo: prepared.employeeNo }) });
    }

    const membership = prepared.kind === 'signin' ? prepared.body.membershipId : null;
    const organization = prepared.kind === 'campaign' ? prepared.body.organizationId : null;
    const target = prepared.body.target;
    const plan = await this.access.plan(database, {
      issuer: actor.membership.id,
      membership,
      organization,
      target,
      kind: prepared.kind,
      expectedVersion,
      expiresAt: prepared.expiresAt,
      policy: registration?.id ?? null,
      termsHash: registration?.terms_hash ?? null,
    });
    if (prepared.kind === 'signin' && plan.principal !== prepared.principal) throw new DomainError('INVITATION_STALE');
    const maxUses = prepared.kind === 'campaign' ? prepared.body.maxUses : 1;
    if (!Number.isSafeInteger(maxUses) || maxUses < 1 || maxUses > 10_000) throw new DomainError('VALIDATION_FAILED', { field: 'maxUses' });
    this.policy.issue(
      {
        kind: prepared.kind,
        target,
        membership: plan.membership,
        principal: prepared.kind === 'signin' ? plan.principal : null,
        recipientHash: prepared.recipientHash,
        maxUses,
        assurance: plan.minimumAssurance,
        reason: prepared.reason,
        expiresAt: prepared.expiresAt,
      },
      new Date()
    );
    const row = await this.repository.create(database, {
      id: prepared.invitation,
      kind: prepared.kind,
      target,
      organization: plan.organization,
      membership: plan.membership,
      principal: prepared.kind === 'signin' ? plan.principal : null,
      recipientHash: prepared.recipientHash,
      token: prepared.token,
      issuer: actor.membership.id,
      issuerAccessVersion: plan.issuerAccessVersion,
      grantDigest: plan.grantDigest,
      assurance: plan.minimumAssurance,
      maxUses,
      expiresAt: prepared.expiresAt,
      policy: registration?.id ?? null,
      termsHash: registration?.terms_hash ?? null,
      reason: prepared.reason,
    });
    await publishInvitation(this.events, database, request, prepared.invitation, plan.organization, prepared.kind, target, plan.membership);
    return invitationReceipt(row, prepared.code.reveal());
  }
}

export type { LoadedInvitation, PreparedInvitation } from './InvitationCreation';
