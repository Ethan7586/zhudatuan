export const MARKETING_CAPABILITIES = Object.freeze({
  read: 'marketing.read',
  manage: 'marketing.manage',
});

export type MarketingCapability = (typeof MARKETING_CAPABILITIES)[keyof typeof MARKETING_CAPABILITIES];
