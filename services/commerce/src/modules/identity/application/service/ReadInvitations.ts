import { IdentityAction as OperationAction } from '../model/IdentityAction';
import { requireAccess } from '../../../../foundation/application/OperationAccess';

import type { InvitationRepository } from '../port/InvitationRepository';
import { DomainError } from '../../../../foundation/domain/DomainError';
import type { MembershipReadPort } from '../../../access/public';
import type { MemberReadPort } from '../../../member/public';

export class ReadInvitations {
  constructor(
    private readonly repository: InvitationRepository,
    private readonly memberships: Pick<MembershipReadPort, 'summaries'>,
    private readonly members: Pick<MemberReadPort, 'profiles'>
  ) {}
  action(): OperationAction<'read'> {
    return async (request, database) => {
      const access = requireAccess(request);
      const cursor = typeof request.input.query.cursor === 'string' ? request.input.query.cursor : null;
      const requested = Number(request.input.query.limit ?? 50);
      const limit = Number.isSafeInteger(requested) ? Math.min(100, Math.max(1, requested)) : 50;
      const target = enumQuery(request.input.query.target, ['console', 'storefront'] as const);
      const kind = enumQuery(request.input.query.kind, ['signin', 'enrollment', 'campaign'] as const);
      const status = enumQuery(request.input.query.status, ['draft', 'active', 'exhausted', 'revoked', 'expired'] as const);
      const records = await this.repository.read(database, { scope: access.scope.id, target, kind, status, cursor, limit });
      const membershipIds = records.flatMap((item) => item.membership_id === null ? [item.issuer_membership_id] : [item.issuer_membership_id, item.membership_id]);
      const references = await this.memberships.summaries(database, membershipIds, access.scope.id);
      const byMembership = new Map(references.map((item) => [item.membership, item]));
      const profiles = await this.members.profiles(database, references.map((item) => item.member));
      const byMember = new Map(profiles.map((item) => [item.member, item]));
      const items = records.map((item) => {
        const issuer = byMembership.get(item.issuer_membership_id);
        const issuerProfile = issuer === undefined ? undefined : byMember.get(issuer.member);
        if (issuer === undefined || issuerProfile === undefined) throw new Error('INVITATION_ISSUER_PROJECTION_MISSING');
        const recipient = item.membership_id === null ? undefined : byMembership.get(item.membership_id);
        const recipientProfile = recipient === undefined ? undefined : byMember.get(recipient.member);
        return Object.freeze({
          ...item,
          recipient_display_name: recipientProfile?.displayName ?? null,
          recipient_employee_no: recipient?.employeeNo ?? null,
          recipient_mobile_masked: recipientProfile?.mobileMasked ?? null,
          issuer_display_name: issuerProfile.displayName,
          issuer_employee_no: issuer.employeeNo,
          issuer_mobile_masked: issuerProfile.mobileMasked,
        });
      });
      const nextCursor = items.length === limit ? String(items.at(-1)?.id ?? '') : undefined;
      return { status: 200, body: { items, count: items.length, ...(nextCursor === undefined ? {} : { nextCursor }) } };
    };
  }
}

function enumQuery<T extends string>(value: unknown, allowed: readonly T[]): T | null {
  if (value === undefined) return null;
  if (typeof value !== 'string' || !allowed.includes(value as T)) throw new DomainError('VALIDATION_FAILED');
  return value as T;
}
