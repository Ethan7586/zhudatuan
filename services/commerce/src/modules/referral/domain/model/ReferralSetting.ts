import { ReferralRate } from '../value/ReferralRate';

export class ReferralSetting {
  readonly rate: ReferralRate;

  constructor(
    readonly id: string,
    readonly scopeId: string,
    readonly enabled: boolean,
    readonly firstTouchDays: number,
    rateBasisPoints: number,
    readonly minimumWithdrawalMinor: bigint,
    readonly currency: string,
    readonly version: number
  ) {
    this.rate = new ReferralRate(rateBasisPoints);
    if (!id || !scopeId || !Number.isSafeInteger(firstTouchDays) || firstTouchDays < 1 || firstTouchDays > 365 || minimumWithdrawalMinor < 0n || !/^[A-Z]{3}$/.test(currency) || !Number.isSafeInteger(version) || version < 0) {
      throw new Error('REFERRAL_SETTING_INVALID');
    }
    Object.freeze(this);
  }
}
