import type { OperationOutputFor } from '@shop/contract';

export const referralSections = ['settings', 'product', 'review', 'binding', 'withdrawal', 'promotion'] as const;
export type ReferralSection = (typeof referralSections)[number];
export const REFERRAL_PAGE_LIMIT = 50;
type ReferralSettingDto = OperationOutputFor<'referral.settings.read'>;
type ReferralMemberDto = OperationOutputFor<'referral.members.read'>['items'][number];
type ReferralBindingDto = OperationOutputFor<'referral.bindings.read'>['items'][number];
type ReferralCommissionDto = OperationOutputFor<'referral.commissions.read'>['items'][number];
type ReferralWithdrawalDto = OperationOutputFor<'referral.withdrawals.read'>['items'][number];

export interface ReferralSetting {
  readonly id: string;
  readonly scopeId: string;
  readonly enabled: boolean;
  readonly recruitEnabled: boolean;
  readonly reviewRequired: boolean;
  readonly rewardEnabled: boolean;
  readonly bindingMode: ReferralSettingDto['bindingMode'];
  readonly firstTouchDays: number;
  readonly freezeDays: number;
  readonly settlementTrigger: ReferralSettingDto['settlementTrigger'];
  readonly rateBasisPoints: number;
  readonly minimumWithdrawalMinor: number;
  readonly monthlyWithdrawalLimit: number | null;
  readonly currency: string;
  readonly version: number;
  readonly updatedAt: string;
}
export interface ReferralProduct {
  readonly id: string;
  readonly productId: string;
  readonly enabled: boolean;
  readonly rateBasisPoints: number;
  readonly rewardBasisPoints: number;
  readonly version: number;
  readonly updatedAt: string;
}
export interface ReferralMember {
  readonly id: string;
  readonly memberId: string;
  readonly status: ReferralMemberDto['status'];
  readonly appliedAt: string;
  readonly approvedAt: string | null;
  readonly disqualifiedAt: string | null;
  readonly version: number;
}
export interface ReferralBinding {
  readonly id: string;
  readonly promoterId: string;
  readonly memberId: string;
  readonly source: ReferralBindingDto['source'];
  readonly boundAt: string;
  readonly expiresAt: string | null;
  readonly status: ReferralBindingDto['status'];
  readonly version: number;
}
export interface ReferralCommission {
  readonly id: string;
  readonly orderId: string;
  readonly orderLineId: string;
  readonly ruleId: string;
  readonly ruleVersion: number;
  readonly attributionId: string;
  readonly promoterId: string;
  readonly kind: ReferralCommissionDto['kind'];
  readonly status: ReferralCommissionDto['status'];
  readonly amountMinor: number;
  readonly baseMinor: number;
  readonly refundedBaseMinor: number;
  readonly reversedMinor: number;
  readonly rateBasisPoints: number;
  readonly currency: string;
  readonly availableAt: string | null;
  readonly settlementJournalId: string | null;
  readonly version: number;
}
export interface ReferralWithdrawal {
  readonly id: string;
  readonly memberId: string;
  readonly status: ReferralWithdrawalDto['status'];
  readonly amountMinor: number;
  readonly currency: string;
  readonly accountRef: string;
  readonly approvalId: string;
  readonly requestedAt: string;
  readonly approvedAt: string | null;
  readonly completedAt: string | null;
  readonly providerReference: string | null;
  readonly failureReason: string | null;
  readonly version: number;
}

export type ReferralPage =
  | Readonly<{ section: 'settings'; items: readonly ReferralSetting[]; count: number; nextCursor?: undefined }>
  | Readonly<{ section: 'product'; items: readonly ReferralProduct[]; count: number; nextCursor?: string }>
  | Readonly<{ section: 'review'; items: readonly ReferralMember[]; count: number; nextCursor?: string }>
  | Readonly<{ section: 'binding'; items: readonly ReferralBinding[]; count: number; nextCursor?: string }>
  | Readonly<{ section: 'withdrawal'; items: readonly ReferralWithdrawal[]; count: number; nextCursor?: string }>
  | Readonly<{ section: 'promotion'; items: readonly ReferralCommission[]; count: number; nextCursor?: string }>;

export type ReferralAction =
  | Readonly<{ kind: 'setting'; item: ReferralSetting; label: string }>
  | Readonly<{ kind: 'product'; item: ReferralProduct; label: string }>
  | Readonly<{ kind: 'approve' | 'disqualify'; item: ReferralMember; label: string }>;

export interface ReferralActionValues {
  readonly action: ReferralAction;
  readonly reason: string;
  readonly enabled: boolean;
  readonly recruitEnabled: boolean;
  readonly reviewRequired: boolean;
  readonly rewardEnabled: boolean;
  readonly bindingMode: ReferralSetting['bindingMode'];
  readonly firstTouchDays: number;
  readonly freezeDays: number;
  readonly settlementTrigger: ReferralSetting['settlementTrigger'];
  readonly rateBasisPoints: number;
  readonly rewardBasisPoints: number;
  readonly minimumWithdrawalMinor: number;
  readonly monthlyWithdrawalLimit: number | null;
  readonly currency: string;
}
