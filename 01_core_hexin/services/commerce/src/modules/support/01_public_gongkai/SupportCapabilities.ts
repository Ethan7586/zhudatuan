export const SUPPORT_CAPABILITIES = Object.freeze({
  read: 'support.read',
  manage: 'support.manage',
} as const);

export type SupportCapability = (typeof SUPPORT_CAPABILITIES)[keyof typeof SUPPORT_CAPABILITIES];
