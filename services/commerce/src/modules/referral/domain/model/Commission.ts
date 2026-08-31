import { ReferralMoney } from '../value/ReferralMoney';

export type CommissionState = 'pending' | 'available' | 'settled' | 'reversed';

export class Commission {
  readonly money: ReferralMoney;
  constructor(
    readonly id: string,
    readonly businessKey: string,
    readonly scopeId: string,
    readonly orderId: string,
    readonly beneficiaryId: string,
    amountMinor: bigint,
    currency: string,
    readonly state: CommissionState,
    readonly reversedMinor: bigint,
    readonly version: number
  ) {
    this.money = new ReferralMoney(amountMinor, currency);
    if (!id || !businessKey || !scopeId || !orderId || !beneficiaryId || reversedMinor < 0n || reversedMinor > amountMinor || version < 1) throw new Error('REFERRAL_COMMISSION_INVALID');
    Object.freeze(this);
  }
}
