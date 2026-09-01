import { IdentityAction as OperationAction } from '../model/IdentityAction';
import { requireWriteTransaction } from '../../../../foundation/persistence/TransactionContext';
import { DomainError } from '../../../../foundation/domain/DomainError';
import { randomUUID } from 'node:crypto';

import { requireAccess } from '../../../../foundation/application/OperationAccess';

import { bodyRecord, integerField, textField } from '../../../../foundation/interface/Validation';
import type { InvitationAccessPort } from '../../../access/public';
import type { InvitationRepository } from '../port/InvitationRepository';
import type { InvitationCodePort, InvitationHashPort } from '../port/InvitationSecurity';
import { InvitationPolicy } from '../../domain/policy/InvitationPolicy';
import type { RegistrationPolicyRepository } from '../port/RegistrationPolicyRepository';
import type { IdentityEventRepository } from '../port/IdentityEventRepository';
import type { Telemetry } from '@shop/telemetry';
import { canonicalIdentitySubject } from '../../domain/value/IdentitySubject';

export class CreateInvitation {
  constructor(
    private readonly repository: InvitationRepository,
    private readonly access: InvitationAccessPort,
    private readonly generator: InvitationCodePort,
    private readonly hasher: InvitationHashPort,
    private readonly registrations: RegistrationPolicyRepository,
    private readonly events: IdentityEventRepository,
    private readonly telemetry: Telemetry,
    private readonly policy = new InvitationPolicy()
  ) {}
  action(): OperationAction {
    return async (request, database) => {
      const actor = requireAccess(request);
      const body = bodyRecord(request.input);
      const kind = kindOf(body.kind);
      const target = targetOf(body.target);
      const membership = optionalId(body.membershipId);
      const organization = optionalId(body.organizationId);
      const expiresAt = new Date(textField(body, 'expiresAt', 64));
      const registration = kind === 'signin' ? null : await this.registrations.current(database);
      if (kind !== 'signin' && !registration) throw new Error('REGISTRATION_POLICY_MISSING');
      const expectedVersion = request.input.expectedVersion;
      if (expectedVersion === undefined) throw new DomainError('VERSION_CONFLICT');
      const plan = await this.access.plan(database, { issuer: actor.membership.id, membership, organization, target, kind, expectedVersion, expiresAt, policy: registration?.id ?? null, termsHash: registration?.terms_hash ?? null });
      const recipient = typeof body.recipient === 'string' && body.recipient.trim() ? this.hasher.recipient(canonicalIdentitySubject(body.recipient)) : null;
      const maxUses = kind === 'campaign' ? (body.maxUses === undefined ? 100 : integerField(body, 'maxUses', 1)) : 1;
      if (maxUses > 10_000) throw new DomainError('VALIDATION_FAILED', { field: 'maxUses' });
      const reason = textField(body, 'reason', 1000);
      const principal = kind === 'signin' ? plan.principal : null;
      this.policy.issue({ kind, target, membership: plan.membership, principal, recipientHash: recipient, maxUses, assurance: plan.minimumAssurance, reason, expiresAt }, new Date());
      const code = this.generator.issue();
      const id = `invitation:${randomUUID()}`;
      const row = await this.repository.create(requireWriteTransaction(database), {
        id,
        kind,
        target,
        organization: plan.organization,
        membership: plan.membership,
        principal,
        recipientHash: recipient,
        token: this.hasher.current(code),
        issuer: actor.membership.id,
        issuerAccessVersion: plan.issuerAccessVersion,
        grantDigest: plan.grantDigest,
        assurance: plan.minimumAssurance,
        maxUses,
        expiresAt,
        policy: registration?.id ?? null,
        termsHash: registration?.terms_hash ?? null,
        reason,
      });
      await this.events.publish(database, 'identity.invitation.issued', 'invitation', id, plan.organization, actor.trace, { invitationId: id, kind, target, membershipId: plan.membership });
      this.telemetry.metrics.count('identity_invitation_issued_total', 1, { requestId: actor.trace, traceId: actor.trace, module: 'identity', operation: request.type, result: 'success', resourceType: kind, target });
      return { status: 201, body: { ...row, code: code.display() }, headers: { etag: `"${String(row.version)}"` } };
    };
  }
}
function kindOf(value: unknown): 'signin' | 'enrollment' | 'campaign' {
  if (value !== 'signin' && value !== 'enrollment' && value !== 'campaign') throw new DomainError('VALIDATION_FAILED', { field: 'kind' });
  return value;
}
function targetOf(value: unknown): 'console' | 'storefront' {
  if (value !== 'console' && value !== 'storefront') throw new DomainError('VALIDATION_FAILED', { field: 'target' });
  return value;
}
function optionalId(value: unknown): string | null {
  if (value === undefined) return null;
  if (typeof value !== 'string' || value.length < 1 || value.length > 200) throw new DomainError('VALIDATION_FAILED');
  return value;
}
