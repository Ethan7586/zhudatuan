import type { ReferralWithdrawal } from '../model/Referral';

export interface WithdrawalViewModel {
  readonly kind: 'withdrawal';
  readonly rows: readonly ReferralWithdrawal[];
}
export function withdrawalViewModel(rows: readonly ReferralWithdrawal[]): WithdrawalViewModel {
  return Object.freeze({ kind: 'withdrawal', rows });
}
