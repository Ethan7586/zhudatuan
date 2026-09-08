import type { ReadTransactionContext } from '../../../../platform/database/TransactionContext';

export interface MembershipProfile {
  readonly id: string;
  readonly member: string;
  readonly organization: string;
  readonly employee: string | null;
  readonly status: string;
  readonly accessVersion: number;
  readonly joinedAt: string;
  readonly registrationResetAllowed: boolean;
  readonly registrationResetBlockReason: 'self' | 'protected' | 'inactive' | null;
}

export interface MemberProfile {
  readonly id: string;
  readonly displayName: string;
  readonly status: string;
  readonly mobileBound: boolean;
  readonly loginIdentityBound: boolean;
  readonly locale: string;
  readonly timezone: string;
  readonly marketingAllowed: boolean;
  readonly preferenceVersion: number;
}

export type MemberListProfile = Pick<MemberProfile, 'id' | 'displayName' | 'status' | 'mobileBound' | 'loginIdentityBound'>;

export interface MemberRepository {
  memberships(context: ReadTransactionContext, organization: string, actorMembership: string, after: string | null, fetch: number): Promise<readonly MembershipProfile[]>;
  profiles(context: ReadTransactionContext, members: readonly string[]): Promise<readonly MemberListProfile[]>;
  membership(context: ReadTransactionContext, membership: string): Promise<MembershipProfile>;
  profile(context: ReadTransactionContext, member: string): Promise<MemberProfile | null>;
}
