export const REFERRAL_SOURCES = ['storefront', 'miniapp', 'checkout'] as const;
export type ReferralSource = (typeof REFERRAL_SOURCES)[number];
export type ReferralBindingState = 'active' | 'superseded';

export class ReferralBinding {
  constructor(
    readonly id: string,
    readonly scopeId: string,
    readonly customerId: string,
    readonly promoterId: string,
    readonly promoterMemberId: string,
    readonly tokenFingerprint: string,
    readonly source: ReferralSource,
    readonly boundAt: string,
    readonly expiresAt: string | null,
    readonly state: ReferralBindingState,
    readonly version: number
  ) {
    const bound = Date.parse(boundAt);
    const expires = expiresAt === null ? null : Date.parse(expiresAt);
    if (
      !id ||
      !scopeId ||
      !customerId ||
      !promoterId ||
      !promoterMemberId ||
      !/^[a-f0-9]{64}$/.test(tokenFingerprint) ||
      !REFERRAL_SOURCES.includes(source) ||
      !Number.isFinite(bound) ||
      (expires !== null && (!Number.isFinite(expires) || expires <= bound)) ||
      !['active', 'superseded'].includes(state) ||
      !Number.isSafeInteger(version) ||
      version < 1
    ) {
      throw new Error('REFERRAL_BINDING_INVALID');
    }
    Object.freeze(this);
  }
}
