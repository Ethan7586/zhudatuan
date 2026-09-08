import type { OperationOutputFor } from '@shop/contract';

export interface ReferralAttributionInput {
  readonly search: string;
  readonly mallId: string;
  readonly memberId: string;
}

export type ReferralAttributionResult =
  | Readonly<{ status: 'ignored'; reason: 'absent' | 'malformed' | 'untrusted-context' }>
  | Readonly<{ status: 'deduplicated' }>
  | Readonly<{ status: 'bound'; candidateWon: boolean }>
  | Readonly<{ status: 'failed' }>;

export type ReferralMember = OperationOutputFor<'referral.members.apply'>;
export type ReferralEarnings = OperationOutputFor<'referral.earnings.read'>;
export type ReferralCommission = ReferralEarnings['items'][number];
export type ReferralLink = OperationOutputFor<'referral.links.read'>;
export type ReferralWithdrawal = OperationOutputFor<'referral.withdrawals.read'>['items'][number];
export interface ReferralWithdrawalPage {
  readonly items: readonly ReferralWithdrawal[];
  readonly nextCursor: string | null;
}
