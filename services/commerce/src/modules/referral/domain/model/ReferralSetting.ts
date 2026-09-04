import { ReferralRate } from '../value/ReferralRate';

export type BindingMode = 'permanent' | 'days';
export type SettlementTrigger = 'paid' | 'received';

export class ReferralSetting {
  readonly rate: ReferralRate;

  constructor(
    readonly id: string,
    readonly scopeId: string,
    readonly enabled: boolean,
    readonly recruitEnabled: boolean,
    readonly reviewRequired: boolean,
    readonly rewardEnabled: boolean,
    readonly bindingMode: BindingMode,
    readonly firstTouchDays: number,
    readonly freezeDays: number,
    readonly settlementTrigger: SettlementTrigger,
    rateBasisPoints: number,
    readonly minimumWithdrawalMinor: bigint,
    readonly monthlyWithdrawalLimit: number | null,
    readonly currency: string,
    readonly version: number
  ) {
    this.rate = new ReferralRate(rateBasisPoints);
    if (
      !id ||
      !scopeId ||
      !['permanent', 'days'].includes(bindingMode) ||
      !Number.isSafeInteger(firstTouchDays) ||
      firstTouchDays < 1 ||
      firstTouchDays > 3650 ||
      !Number.isSafeInteger(freezeDays) ||
      freezeDays < 0 ||
      freezeDays > 3650 ||
      !['paid', 'received'].includes(settlementTrigger) ||
      minimumWithdrawalMinor < 0n ||
      (monthlyWithdrawalLimit !== null && (!Number.isSafeInteger(monthlyWithdrawalLimit) || monthlyWithdrawalLimit < 1 || monthlyWithdrawalLimit > 1000)) ||
      !/^[A-Z]{3}$/.test(currency) ||
      !Number.isSafeInteger(version) ||
      version < 0
    ) {
      throw new Error('REFERRAL_SETTING_INVALID');
    }
    Object.freeze(this);
  }
}
