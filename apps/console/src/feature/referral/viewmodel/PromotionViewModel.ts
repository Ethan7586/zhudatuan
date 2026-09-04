import type { ReferralCommission } from '../model/Referral';

export interface PromotionViewModel {
  readonly kind: 'promotion';
  readonly rows: readonly ReferralCommission[];
}
export function promotionViewModel(rows: readonly ReferralCommission[]): PromotionViewModel {
  return Object.freeze({ kind: 'promotion', rows });
}
