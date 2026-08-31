import { ReferralMoney } from '../value/ReferralMoney';

export type WithdrawalState = 'requested' | 'processing' | 'paid' | 'failed';

export class Withdrawal {
  readonly money: ReferralMoney;
  constructor(
    readonly id: string,
    readonly scopeId: string,
    readonly memberId: string,
    amountMinor: bigint,
    currency: string,
    readonly accountRef: string,
    readonly state: WithdrawalState,
    readonly version: number
  ) {
    this.money = new ReferralMoney(amountMinor, currency);
    if (!id || !scopeId || !memberId || !accountRef || version < 1) throw new Error('REFERRAL_WITHDRAWAL_INVALID');
    Object.freeze(this);
  }
}
