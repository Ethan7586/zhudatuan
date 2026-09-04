import type { ReadTransactionContext, WriteTransactionContext } from '../../../../foundation/persistence/TransactionContext';
import { requireWriteTransaction } from '../../../../foundation/persistence/TransactionContext';
import { createHmac, randomUUID } from 'node:crypto';
import { DomainError } from '../../../../foundation/domain/DomainError';

import type { OperationRequest, OperationResult } from '../../../../foundation/application/OperationRequest';
import { textField } from '../../../../foundation/application/Validation';
import { requirePreauth } from '../../../../foundation/security/OperationSecurityContext';
import type { InvitationAccessPort } from '../../../access/public';
import type { IdentityRegistrationPort } from '../../../member/public';
import type { InvitationRepository } from '../port/InvitationRepository';
import type { SessionIssuer } from '../port/SessionIssuer';
import type { ChallengePort } from '../port/ChallengePort';
import type { InvitationHashPort } from '../port/InvitationSecurity';
import type { AuthTicketPort } from '../port/AuthTicketPort';
import type { LinkCaseRepository } from '../port/LinkCaseRepository';
import type { SessionCookiePort } from '../port/SessionCookiePort';
import type { AssuranceRepository } from '../port/AssuranceRepository';
import type { EnrollmentRepository } from '../port/EnrollmentRepository';
import type { IdentityEventRepository } from '../port/IdentityEventRepository';
import { EnrollmentPolicy } from '../../domain/policy/EnrollmentPolicy';
import type { InvitationRedeemer } from './InvitationRedeemer';
import type { Telemetry } from '@shop/telemetry';
import type { InvitationFailure } from './InvitationFailure';
import { concealEnrollmentAccess as concealAccess, maskEnrollmentSubject as mask, type EnrollmentDraft, type EnrollmentInvitationScope } from './EnrollmentData';

export class EnrollIdentity {
  constructor(
    private readonly repository: InvitationRepository,
    private readonly access: InvitationAccessPort,
    private readonly members: IdentityRegistrationPort,
    private readonly sessions: SessionIssuer,
    private readonly hasher: InvitationHashPort,
    private readonly identityKey: string,
    private readonly sessionKey: string,
    private readonly tickets: AuthTicketPort,
    private readonly challenges: ChallengePort,
    private readonly linkcases: LinkCaseRepository,
    private readonly redeemer: InvitationRedeemer,
    private readonly cookies: SessionCookiePort,
    private readonly telemetry: Telemetry,
    private readonly enrollments: EnrollmentRepository,
    private readonly assurances: AssuranceRepository,
    private readonly events: IdentityEventRepository,
    private readonly failures: InvitationFailure,
    private readonly policy = new EnrollmentPolicy()
  ) {}

  async load(context: ReadTransactionContext, claim: string, target: 'console' | 'storefront' | 'miniapp' | 'store' | 'supplier'): Promise<EnrollmentInvitationScope> {
    const invitation = await this.repository.claimed(context, claim, target);
    if (invitation.state.kind === 'campaign') {
      return Object.freeze({ invitation: invitation.state.id, scope: invitation.state.organization, mode: 'campaign', principal: null, mobileCiphertext: null, displayName: null });
    }
    if (invitation.state.kind !== 'enrollment' || !invitation.state.membership) throw new DomainError('INVITATION_INVALID');
    const pending = await this.members.pending(context, await this.access.pending(context, invitation.state.membership));
    return Object.freeze({
      invitation: invitation.state.id,
      scope: invitation.state.organization,
      mode: 'bound',
      principal: pending.principal,
      mobileCiphertext: pending.mobileCiphertext,
      displayName: pending.displayName,
    });
  }

  async complete(request: OperationRequest, database: WriteTransactionContext, prepared: EnrollmentDraft): Promise<OperationResult> {
    const preauth = requirePreauth(request.security, 'enrollment');
    const base = { requestId: preauth.trace, traceId: preauth.trace, module: 'identity', operation: 'identity.enrollments.complete' };
    try {
      const result = await this.perform(request, database, prepared);
      const outcome = result.status < 400 ? 'success' : 'failure';
      this.telemetry.metrics.count('identity_enrollment_complete_total', 1, { ...base, result: outcome });
      if (outcome === 'failure') this.telemetry.metrics.count('identity_invitation_failure_total', 1, { ...base, result: outcome });
      return result;
    } catch (cause) {
      const errorCode = cause instanceof DomainError ? cause.code : 'ENROLLMENT_COMPLETE_FAILED';
      this.telemetry.metrics.count('identity_enrollment_complete_total', 1, { ...base, result: 'failure', errorCode });
      this.telemetry.metrics.count('identity_invitation_failure_total', 1, { ...base, result: 'failure', errorCode });
      throw cause;
    }
  }

  private async perform(request: OperationRequest, database: WriteTransactionContext, prepared: EnrollmentDraft): Promise<OperationResult> {
    const preauth = requirePreauth(request.security, 'enrollment');
    if (request.input.path.id !== preauth.reference) throw new DomainError('PREAUTH_REQUIRED');
    const invitation = await this.repository.lockClaimed(requireWriteTransaction(database), preauth.reference, preauth.target);
    const claim = await this.repository.claim(requireWriteTransaction(database), preauth.reference);
    if (
      invitation.state.id !== prepared.invitation ||
      invitation.state.organization !== prepared.scope ||
      claim.invitation !== invitation.state.id ||
      claim.kind !== invitation.state.kind ||
      claim.target !== preauth.target ||
      claim.state !== 'proofpending' ||
      !claim.recipientHash ||
      !invitation.state.termsHash ||
      (invitation.state.kind === 'campaign') !== (prepared.mode === 'campaign')
    )
      throw new DomainError('INVITATION_INVALID');
    if (!this.hasher.matchesRecipient(prepared.subject, claim.recipientHash) || (invitation.state.recipientHash && !this.hasher.matchesRecipient(prepared.subject, invitation.state.recipientHash))) {
      throw new DomainError('INVITATION_INVALID');
    }
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
      } else await this.redeemer.validate(database, invitation, 'storefront');
    } catch (cause) {
      return this.failures.reject(database, request, invitation.state.id, invitation.state.organization, cause, 'INVITATION_INVALID');
    }
    try {
      await this.challenges.consume(requireWriteTransaction(database), textField(prepared.body, 'challenge'), textField(prepared.body, 'code', 16), (id, code) => this.code(id, code), preauth.principal ?? undefined, {
        purpose: prepared.mode === 'campaign' ? 'enrollment_campaign' : 'enrollment',
        destinationHash: claim.recipientHash.toString('hex'),
      });
    } catch (cause) {
      await this.failures.record(database, request, invitation.state.id, invitation.state.organization, cause);
      throw cause;
    }
    this.policy.complete({ termsAccepted: prepared.body.termsAccepted === true, termsHash: textField(prepared.body, 'termsHash', 64), expectedTermsHash: invitation.state.termsHash });
    const subjectHash = this.subject(prepared.subject);
    await this.members.lockMobile(requireWriteTransaction(database), prepared.mobile.fingerprint);
    const existing = await this.enrollments.findPrincipal(database, subjectHash);
    let principal = prepared.principal;
    let member: string;
    let membership: string;
    let activationDigest = invitation.state.grantDigest;
    if (invitation.state.kind === 'campaign') {
      member = `member:${randomUUID()}`;
      membership = `membership:${randomUUID()}`;
    } else {
      if (!invitation.state.membership || !preauth.principal) throw new DomainError('INVITATION_INVALID');
      membership = invitation.state.membership;
      const pending = await this.members.lockPending(requireWriteTransaction(database), await this.access.pending(database, membership));
      if (pending.principal !== preauth.principal || prepared.principal !== preauth.principal) throw new DomainError('INVITATION_INVALID');
      principal = pending.principal;
      member = pending.member;
    }
    const mobileOwner = await this.members.mobileOwner(database, prepared.mobile.fingerprint, invitation.state.kind === 'campaign' ? undefined : member);
    const candidate = existing ?? mobileOwner?.principal ?? null;
    if (candidate) {
      const conflict = await this.linkcases.enrollment(database, invitation.state.organization, preauth.reference, Buffer.from(subjectHash, 'hex'), candidate);
      await this.events.publish(database, 'identity.link.required', 'linkcase', conflict.id, invitation.state.organization, preauth.trace, { linkCase: conflict.id, invitation: invitation.state.id, reason: 'subjectconflict' });
      return { status: 409, body: { code: 'IDENTITY_LINK_REQUIRED', linkCase: conflict.id } };
    }
    if (invitation.state.kind === 'campaign') {
      await this.enrollments.createPendingPrincipal(database, { principal, createdAt: new Date() });
      await this.members.createPending(requireWriteTransaction(database), {
        member,
        principal,
        display: prepared.display,
        mobileCiphertext: prepared.mobile.ciphertext,
        mobileFingerprint: prepared.mobile.fingerprint,
        mobileMasked: mask(prepared.subject),
      });
      activationDigest = (
        await concealAccess(
          this.access.createCampaign(requireWriteTransaction(database), {
            issuer: invitation.state.issuer,
            issuerAccessVersion: invitation.state.issuerAccessVersion,
            grantDigest: invitation.state.grantDigest,
            organization: invitation.state.organization,
            membership,
            member,
            principal,
            policy: invitation.state.policy,
            termsHash: invitation.state.termsHash,
            expiresAt: invitation.state.expiresAt,
          })
        )
      ).activationDigest;
    }
    await this.enrollments.activatePrincipal(database, principal);
    await this.enrollments.createPassword(database, principal, subjectHash, prepared.password);
    await this.members.activate(requireWriteTransaction(database), {
      member,
      principal,
      display: prepared.display,
      mobileCiphertext: prepared.mobile.ciphertext,
      mobileFingerprint: prepared.mobile.fingerprint,
      mobileMasked: mask(prepared.subject),
    });
    await concealAccess(
      this.access.activate(requireWriteTransaction(database), {
        issuer: invitation.state.issuer,
        issuerAccessVersion: invitation.state.issuerAccessVersion,
        membership,
        principal,
        grantDigest: activationDigest,
        organization: invitation.state.organization,
        target: 'storefront',
        invitation: invitation.state.id,
        policy: invitation.state.policy,
        termsHash: invitation.state.termsHash,
        trace: preauth.trace,
      })
    );
    await this.assurances.record(requireWriteTransaction(database), { principal, method: 'enrollment_otp', level: 2, evidenceHash: subjectHash, expiresIn: '365days' });
    const session =
      invitation.state.kind === 'campaign'
        ? null
        : await this.sessions.issue(requireWriteTransaction(database), {
            principal,
            membership,
            assurance: 2,
            target: 'storefront',
            device: request.input.headers['x-device-id'] ?? 'browser',
            peer: request.input.headers['x-peer-address'] ?? 'unknown',
            agent: request.input.headers['user-agent'] ?? 'unknown',
            trace: preauth.trace,
          });
    await this.redeemer.consume(database, invitation, { session: session?.session ?? null, assurance: 2, trace: preauth.trace, principal, membership, claim: { id: preauth.reference, version: claim.version } });
    await this.events.publish(database, 'identity.enrollment.completed', 'membership', membership, invitation.state.organization, preauth.trace, { invitationId: invitation.state.id, membershipId: membership });
    if (session === null) return { status: 201, body: { kind: 'enrolled', target: 'storefront' }, headers: { 'x-clear-cookie': this.cookies.preauth('', 0) } };
    const ticket = await this.tickets.issue(requireWriteTransaction(database), session.session, 'storefront', prepared.authorization);
    return { status: 201, body: { kind: 'session', ticket: ticket.ticket, returnTarget: prepared.returnTarget }, headers: { ...session.headers, 'x-clear-cookie': this.cookies.preauth('', 0) } };
  }

  private subject(value: string): string {
    return createHmac('sha256', this.identityKey).update(value.trim().toLowerCase()).digest('hex');
  }
  private code(id: string, value: string): string {
    return createHmac('sha256', this.sessionKey).update(`${id}:${value}`).digest('hex');
  }
}

export type { EnrollmentDraft, EnrollmentInvitationScope } from './EnrollmentData';
