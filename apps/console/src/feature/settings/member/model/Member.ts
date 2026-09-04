export interface Member {
  readonly id: string;
  readonly displayName: string;
  readonly profileStatus: string;
  readonly membershipId: string;
  readonly organizationId: string;
  readonly employeeNo: string | null;
  readonly membershipStatus: string;
  readonly accessVersion: number;
  readonly joinedAt: string | null;
}

export interface MemberPage {
  readonly items: readonly Member[];
  readonly count: number;
  readonly nextCursor?: string;
}

export type MemberChange = Readonly<{ kind: 'profile'; member: Member; displayName: string; reason: string }> | Readonly<{ kind: 'status'; member: Member; status: 'active' | 'suspended' | 'left'; reason: string }>;

export interface MemberReceipt {
  readonly referenceId: string;
  readonly kind: MemberChange['kind'];
  readonly version: number;
}
export interface MemberImportSource {
  readonly objectRef: string;
  readonly sha256: string;
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
