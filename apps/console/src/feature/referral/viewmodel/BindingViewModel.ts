import type { ReferralBinding } from '../model/Referral';

export interface BindingViewModel {
  readonly kind: 'binding';
  readonly rows: readonly ReferralBinding[];
}
export function bindingViewModel(rows: readonly ReferralBinding[]): BindingViewModel {
  return Object.freeze({ kind: 'binding', rows });
}
