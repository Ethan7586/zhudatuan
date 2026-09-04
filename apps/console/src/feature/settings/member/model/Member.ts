import type { OperationOutputFor } from '@shop/contract';

type MemberDto = OperationOutputFor<'member.members.read'>['items'][number];
type MemberManageOutput = OperationOutputFor<'identity.members.manage'>;
type MemberManagedState =
  | Extract<MemberManageOutput, { action: 'enable' }>['status']
  | Extract<MemberManageOutput, { action: 'disable' }>['status']
  | Extract<MemberManageOutput, { action: 'offboard' }>['status'];

export interface Member {
  readonly id: string;
  readonly displayName: string;
  readonly profileStatus: string;
  readonly membershipId: string;
  readonly organizationId: string;
  readonly employeeNo: string | null;
  readonly membershipStatus: string;
  readonly accessVersion: number;
  readonly joinedAt: MemberDto['joined_at'];
  readonly loginIdentityBound: boolean;
  readonly registrationResetAllowed: boolean;
  readonly registrationResetBlockReason: MemberDto['registration_reset_block_reason'];
}

export interface MemberPage {
  readonly items: readonly Member[];
  readonly count: number;
  readonly nextCursor?: string;
}

export type MemberChange = Readonly<{ kind: 'profile'; member: Member; displayName: string; reason: string }> | Readonly<{ kind: 'status'; member: Member; status: MemberManagedState; reason: string }>;

export interface MemberReceipt {
  readonly referenceId: string;
  readonly kind: MemberChange['kind'];
  readonly version: number;
}
export interface RegistrationResetDraft {
  readonly member: Member;
  readonly reason: string;
  readonly understood: boolean;
  readonly confirmation: string;
  readonly ownerPassword: string;
}
export interface RegistrationResetReceipt {
  readonly memberId: string;
  readonly principalId: string;
  readonly status: 'reset';
  readonly loginIdentityReleased: true;
  readonly historyRetained: true;
  readonly memberships: readonly string[];
  readonly accessVersion: number;
  readonly profileVersion: number;
  readonly principalVersion: number;
}
export interface MemberImportSource {
  readonly file: File;
}
export interface MemberImportTask {
  readonly id: string;
  readonly state: string;
  readonly totalCount: number;
  readonly cursor: number;
  readonly successCount: number;
  readonly failureCount: number;
  readonly createdAt: string;
  readonly updatedAt: string;
}
