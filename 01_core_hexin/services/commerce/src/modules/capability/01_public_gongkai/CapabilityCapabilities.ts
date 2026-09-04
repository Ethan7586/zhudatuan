export const CAPABILITY_CAPABILITIES = Object.freeze({
  read: 'capability.read',
  manage: 'capability.manage',
});

export type CapabilityCapability = (typeof CAPABILITY_CAPABILITIES)[keyof typeof CAPABILITY_CAPABILITIES];
