export const IDENTITY_CAPABILITIES = {
  read: 'identity.read',
  manage: 'identity.manage',
} as const;

export type IdentityCapability = typeof IDENTITY_CAPABILITIES[keyof typeof IDENTITY_CAPABILITIES];
