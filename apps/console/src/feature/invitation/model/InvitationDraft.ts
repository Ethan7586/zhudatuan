import type { IdentityInvitationsCreateBody } from '@shop/contract';

export type InvitationDraft = IdentityInvitationsCreateBody;

export interface EmployeeDraft {
  readonly displayName: string;
  readonly mobile: string;
  readonly employeeNo: string;
  readonly departmentId: string;
  readonly expiresAt: string;
  readonly reason: string;
}

export function employeeInvitation(scope: string, draft: EmployeeDraft): InvitationDraft {
  return Object.freeze({
    kind: 'enrollment',
    target: 'storefront',
    organizationId: scope,
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
