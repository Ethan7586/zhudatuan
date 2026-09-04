export const BENEFIT_CAPABILITIES = Object.freeze({
  read: 'benefit.read',
  manage: 'benefit.manage',
} as const);

export type BenefitCapability = (typeof BENEFIT_CAPABILITIES)[keyof typeof BENEFIT_CAPABILITIES];
