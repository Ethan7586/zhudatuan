import { deepFreeze } from '../../../shared/model/Immutable';
import type { Invitation, InvitationMembershipPage, InvitationPage, InvitationReceipt, InvitationRevocation } from '../model/Invitation';
import { InvitationMembershipPageSchema, InvitationPageSchema, InvitationReceiptSchema, InvitationRevocationSchema } from './InvitationSchema';

export class InvitationMapper {
  page(value: unknown): InvitationPage {
    const page = InvitationPageSchema.parse(value);
    if (page.count !== page.items.length) throw new Error('INVITATION_PAGE_COUNT_MISMATCH');
    return deepFreeze({ items: page.items.map((item) => this.invitation(item)), count: page.count, ...(page.nextCursor === undefined ? {} : { nextCursor: page.nextCursor }) });
  }

  memberships(value: unknown): InvitationMembershipPage {
    const page = InvitationMembershipPageSchema.parse(value) as Readonly<{ items: readonly Readonly<{ id: string; client: 'console' | 'storefront' }>[]; count: number; nextCursor?: string }>;
    if (page.count !== page.items.length) throw new Error('INVITATION_MEMBERSHIP_COUNT_MISMATCH');
    return deepFreeze({ items: page.items.map((item) => ({ id: item.id, client: item.client })), count: page.count, ...(page.nextCursor === undefined ? {} : { nextCursor: page.nextCursor }) });
  }

  receipt(value: unknown): InvitationReceipt {
    const item = InvitationReceiptSchema.parse(value);
    return deepFreeze({
      id: item.id,
      kind: item.kind,
      target: item.target,
      organizationId: item.organizationId,
      ...(item.membershipId === undefined ? {} : { membershipId: item.membershipId }),
      maxUses: item.maxUses,
      useCount: item.useCount,
      expiresAt: item.expiresAt,
      status: item.status,
      version: item.version,
      code: item.code,
      ...(item.recipientMasked === undefined ? {} : { recipientMasked: item.recipientMasked }),
      ...(item.employee === undefined ? {} : { employee: { displayName: item.employee.displayName, ...(item.employee.employeeNo === undefined ? {} : { employeeNo: item.employee.employeeNo }) } }),
    });
  }

  revocation(value: unknown): InvitationRevocation {
    const item = InvitationRevocationSchema.parse(value);
    return deepFreeze({ id: item.id, kind: item.kind, target: item.target, status: item.status, revokedAt: item.revoked_at, revokedBy: item.revoked_by, revokeReason: item.revoke_reason, version: item.version });
  }

  private invitation(item: ReturnType<typeof InvitationPageSchema.parse>['items'][number]): Invitation {
    return {
      id: item.id,
      kind: item.kind,
      target: item.target,
      organizationId: item.organization_id,
      membershipId: item.membership_id,
      recipientDisplayName: item.recipient_display_name,
      recipientEmployeeNo: item.recipient_employee_no,
      recipientMobileMasked: item.recipient_mobile_masked,
      issuerMembershipId: item.issuer_membership_id,
      issuerDisplayName: item.issuer_display_name,
      issuerEmployeeNo: item.issuer_employee_no,
      issuerMobileMasked: item.issuer_mobile_masked,
      issuerAccessVersion: item.issuer_access_version,
      minimumAssurance: item.minimum_assurance,
      maxUses: item.max_uses,
      useCount: item.use_count,
      notBefore: item.not_before,
      expiresAt: item.expires_at,
      status: item.status,
      reason: item.reason,
      createdAt: item.created_at,
      revokedAt: item.revoked_at,
      revokedBy: item.revoked_by,
      revokeReason: item.revoke_reason,
      version: item.version,
    };
  }
}
