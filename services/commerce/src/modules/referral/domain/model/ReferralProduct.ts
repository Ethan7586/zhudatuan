import { ReferralRate } from '../value/ReferralRate';

export class ReferralProduct {
  readonly rate: ReferralRate;
  constructor(
    readonly id: string,
    readonly scopeId: string,
    readonly productId: string,
    readonly enabled: boolean,
    basisPoints: number,
    readonly version: number
  ) {
    this.rate = new ReferralRate(basisPoints);
    if (!id || !scopeId || !productId || !Number.isSafeInteger(version) || version < 0) throw new Error('REFERRAL_PRODUCT_INVALID');
    Object.freeze(this);
  }
}
