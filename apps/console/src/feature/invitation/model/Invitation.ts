import type { OperationOutputFor, OperationTarget } from '@shop/contract';

type InvitationDto = OperationOutputFor<'identity.invitations.read'>['items'][number];
type InvitationMembershipDto = OperationOutputFor<'access.center.read'>['items'][number];
export type InvitationKind = InvitationDto['kind'];
export type InvitationTargetKind = OperationTarget;
export type InvitationStatus = InvitationDto['status'];

export interface Invitation {
  readonly id: string;
  readonly kind: InvitationKind;
  readonly target: InvitationTargetKind;
  readonly organizationId: string;
  readonly membershipId: string | null;
  readonly recipientDisplayName: string | null;
  readonly recipientEmployeeNo: string | null;
  readonly recipientMobileMasked: string | null;
  readonly issuerMembershipId: string;
  readonly issuerDisplayName: string;
  readonly issuerEmployeeNo: string | null;
  readonly issuerMobileMasked: string | null;
  readonly issuerAccessVersion: number;
  readonly minimumAssurance: number;
  readonly maxUses: number;
  readonly useCount: number;
  readonly notBefore: string;
  readonly expiresAt: string;
  readonly status: InvitationStatus;
  readonly reason: string;
  readonly createdAt: string;
  readonly revokedAt: string | null;
  readonly revokedBy: string | null;
  readonly revokeReason: string | null;
  readonly version: number;
}

export interface InvitationPage {
  readonly items: readonly Invitation[];
  readonly count: number;
  readonly nextCursor?: string;
}
export interface InvitationEmployee {
  readonly displayName: string;
  readonly employeeNo?: string;
}
export interface InvitationReceipt {
  readonly id: string;
  readonly kind: InvitationKind;
  readonly target: InvitationTargetKind;
  readonly organizationId: string;
  readonly membershipId?: string;
  readonly maxUses: number;
  readonly useCount: number;
  readonly expiresAt: string;
  readonly status: 'active';
  readonly version: number;
  readonly code: string;
  readonly recipientMasked?: string;
  readonly employee?: InvitationEmployee;
}
export interface InvitationRevocation {
  readonly id: string;
  readonly kind: InvitationKind;
  readonly target: InvitationTargetKind;
  readonly status: 'revoked';
  readonly revokedAt: string;
  readonly revokedBy: string;
  readonly revokeReason: string;
  readonly version: number;
}
export interface InvitationMembership {
  readonly id: string;
  readonly displayName: string;
  readonly employeeNo: string | null;
  readonly mobileMasked: string | null;
  readonly client: InvitationTargetKind;
  readonly status: InvitationMembershipDto['status'];
  readonly roles: readonly Readonly<{
    id: string;
    kind: InvitationMembershipDto['roles'][number]['kind'];
    allows: readonly string[];
    denies: readonly string[];
  }>[];
}
export interface InvitationMembershipPage {
  readonly items: readonly InvitationMembership[];
  readonly count: number;
  readonly nextCursor?: string;
}

export interface InvitationFilter {
  readonly target?: InvitationTargetKind;
  readonly status?: InvitationStatus;
  readonly kind?: InvitationKind;
  readonly cursor?: string;
}
