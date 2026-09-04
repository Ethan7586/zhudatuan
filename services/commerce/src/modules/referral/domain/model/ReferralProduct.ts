import { ReferralRate } from '../value/ReferralRate';

export class ReferralProduct {
  readonly rate: ReferralRate;
  readonly rewardRate: ReferralRate;
  constructor(
    readonly id: string,
    readonly scopeId: string,
    readonly productId: string,
    readonly enabled: boolean,
    basisPoints: number,
    rewardBasisPoints: number,
    readonly version: number
  ) {
    this.rate = new ReferralRate(basisPoints);
    this.rewardRate = new ReferralRate(rewardBasisPoints);
    if (basisPoints + rewardBasisPoints > 10_000) throw new Error('REFERRAL_RATE_TOTAL_INVALID');
    if (!id || !scopeId || !productId || !Number.isSafeInteger(version) || version < 0) throw new Error('REFERRAL_PRODUCT_INVALID');
    Object.freeze(this);
  }
}
