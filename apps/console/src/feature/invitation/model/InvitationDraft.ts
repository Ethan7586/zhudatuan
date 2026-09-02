import type { IdentityInvitationsCreateBody } from '@shop/contract';

export type InvitationDraft = IdentityInvitationsCreateBody;

export interface EmployeeDraft {
  readonly organizationId: string;
  readonly displayName: string;
  readonly mobile: string;
  readonly employeeNo: string;
  readonly departmentId: string;
  readonly expiresAt: string;
  readonly reason: string;
}

export interface CampaignDraft {
  readonly organizationId: string;
  readonly maxUses: number;
  readonly expiresAt: string;
  readonly reason: string;
}

export function employeeInvitation(draft: EmployeeDraft): InvitationDraft {
  return Object.freeze({
    kind: 'enrollment',
    target: 'storefront',
    organizationId: draft.organizationId,
    employee: {
      displayName: draft.displayName.trim(),
      mobile: draft.mobile.trim(),
      ...(draft.employeeNo.trim() === '' ? {} : { employeeNo: draft.employeeNo.trim() }),
      ...(draft.departmentId === '' ? {} : { departmentId: draft.departmentId }),
    },
    expiresAt: draft.expiresAt,
    reason: draft.reason.trim(),
  });
}

export function campaignInvitation(draft: CampaignDraft): InvitationDraft {
  return Object.freeze({ kind: 'campaign', target: 'storefront', organizationId: draft.organizationId, maxUses: draft.maxUses, expiresAt: draft.expiresAt, reason: draft.reason.trim() });
}
