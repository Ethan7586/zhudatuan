export const referralSections = ['settings', 'product', 'review', 'binding', 'withdrawal', 'promotion'] as const;
export type ReferralSection = (typeof referralSections)[number];
export const REFERRAL_PAGE_LIMIT = 50;
export interface ReferralSetting {
  readonly id: string;
  readonly scopeId: string;
  readonly enabled: boolean;
  readonly firstTouchDays: number;
  readonly rateBasisPoints: number;
  readonly minimumWithdrawalMinor: number;
  readonly currency: string;
  readonly version: number;
  readonly updatedAt: string;
}
export interface ReferralProduct {
  readonly id: string;
  readonly productId: string;
  readonly enabled: boolean;
  readonly rateBasisPoints: number;
  readonly version: number;
  readonly updatedAt: string;
}
export interface ReferralMember {
  readonly id: string;
  readonly memberId: string;
  readonly status: 'applied' | 'active' | 'disqualified';
  readonly appliedAt: string;
  readonly approvedAt: string | null;
  readonly disqualifiedAt: string | null;
  readonly version: number;
}
export interface ReferralBinding {
  readonly id: string;
  readonly promoterId: string;
  readonly memberId: string;
  readonly source: string;
  readonly boundAt: string;
  readonly version: number;
}

export interface ReferralCommission {
  readonly id: string;
  readonly orderId: string;
  readonly promoterId: string;
  readonly status: 'pending' | 'available' | 'settled' | 'reversed';
  readonly amountMinor: number;
  readonly currency: string;
  readonly availableAt: string | null;
  readonly version: number;
}

export interface ReferralWithdrawal {
  readonly id: string;
  readonly memberId: string;
  readonly status: 'requested' | 'processing' | 'paid' | 'failed';
  readonly amountMinor: number;
  readonly currency: string;
  readonly accountRef: string;
  readonly requestedAt: string;
  readonly completedAt: string | null;
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
  readonly firstTouchDays: number;
  readonly rateBasisPoints: number;
  readonly minimumWithdrawalMinor: number;
  readonly currency: string;
}
