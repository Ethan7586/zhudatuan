export const referralViews = ['settings', 'products', 'members', 'bindings', 'commissions', 'withdrawals'] as const;
export type ReferralView = (typeof referralViews)[number];

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
  | Readonly<{ view: 'settings'; items: readonly ReferralSetting[]; count: number; nextCursor?: undefined }>
  | Readonly<{ view: 'products'; items: readonly ReferralProduct[]; count: number; nextCursor?: string }>
  | Readonly<{ view: 'members'; items: readonly ReferralMember[]; count: number; nextCursor?: string }>
  | Readonly<{ view: 'bindings'; items: readonly ReferralBinding[]; count: number; nextCursor?: string }>
  | Readonly<{ view: 'commissions'; items: readonly ReferralCommission[]; count: number; nextCursor?: string }>
  | Readonly<{ view: 'withdrawals'; items: readonly ReferralWithdrawal[]; count: number; nextCursor?: string }>;

export interface ReferralAction {
  readonly kind: 'setting' | 'product' | 'approve' | 'disqualify';
  readonly id: string;
  readonly version: number;
  readonly label: string;
  readonly setting?: ReferralSetting;
  readonly product?: ReferralProduct;
}
