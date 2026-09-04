import type { ReferralProduct } from '../model/Referral';

export interface ProductViewModel {
  readonly kind: 'product';
  readonly rows: readonly ReferralProduct[];
  readonly canManage: boolean;
  readonly manage: (item: ReferralProduct) => void;
}
export function productViewModel(rows: readonly ReferralProduct[], canManage: boolean, manage: (item: ReferralProduct) => void): ProductViewModel {
  return Object.freeze({ kind: 'product', rows, canManage, manage });
}
