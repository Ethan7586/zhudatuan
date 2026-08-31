export class ReferralBinding {
  constructor(
    readonly id: string,
    readonly scopeId: string,
    readonly customerId: string,
    readonly promoterId: string,
    readonly tokenFingerprint: string,
    readonly boundAt: string,
    readonly version: number
  ) {
    if (!id || !scopeId || !customerId || !promoterId || !/^[a-f0-9]{64}$/.test(tokenFingerprint) || Number.isNaN(Date.parse(boundAt)) || version < 1) throw new Error('REFERRAL_BINDING_INVALID');
    Object.freeze(this);
  }
}
