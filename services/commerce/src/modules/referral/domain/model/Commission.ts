import { ReferralMoney } from '../value/ReferralMoney';
import type { CommissionKind } from '../policy/CommissionPolicy';

export type CommissionState = 'pending' | 'available' | 'settled' | 'reversed';

export class Commission {
  readonly money: ReferralMoney;
  constructor(
    readonly id: string,
    readonly businessKey: string,
    readonly scopeId: string,
    readonly orderId: string,
    readonly orderLineId: string,
    readonly ruleId: string,
    readonly ruleVersion: number,
    readonly attributionId: string,
    readonly beneficiaryId: string,
    readonly kind: CommissionKind,
    readonly baseMinor: bigint,
    readonly refundedBaseMinor: bigint,
    readonly rateBasisPoints: number,
    amountMinor: bigint,
    currency: string,
    readonly state: CommissionState,
    readonly reversedMinor: bigint,
    readonly version: number
  ) {
    this.money = new ReferralMoney(amountMinor, currency);
    if (
      !id ||
      !businessKey ||
      !scopeId ||
      !orderId ||
      !orderLineId ||
      !ruleId ||
      !attributionId ||
      !beneficiaryId ||
      !Number.isSafeInteger(ruleVersion) ||
      ruleVersion < 1 ||
      baseMinor < 0n ||
      refundedBaseMinor < 0n ||
      refundedBaseMinor > baseMinor ||
      !Number.isSafeInteger(rateBasisPoints) ||
      rateBasisPoints < 0 ||
      rateBasisPoints > 10_000 ||
      reversedMinor < 0n ||
      reversedMinor > amountMinor ||
      version < 1
    )
      throw new Error('REFERRAL_COMMISSION_INVALID');
    Object.freeze(this);
  }
}
