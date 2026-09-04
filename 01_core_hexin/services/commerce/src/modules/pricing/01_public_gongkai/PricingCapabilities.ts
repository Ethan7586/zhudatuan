export const PRICING_CAPABILITIES = Object.freeze({
  read: 'pricing.read',
  manage: 'pricing.manage',
});

export type PricingCapability = (typeof PRICING_CAPABILITIES)[keyof typeof PRICING_CAPABILITIES];
