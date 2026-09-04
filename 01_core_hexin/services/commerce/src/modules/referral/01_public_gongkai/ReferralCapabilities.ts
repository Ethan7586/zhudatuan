export const REFERRAL_CAPABILITIES = Object.freeze({
  read: 'referral.read',
  manage: 'referral.manage',
} as const);

export type ReferralCapability = (typeof REFERRAL_CAPABILITIES)[keyof typeof REFERRAL_CAPABILITIES];
