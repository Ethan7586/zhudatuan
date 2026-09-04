export const VERIFICATION_CAPABILITIES = Object.freeze({
  read: 'verification.read',
  manage: 'verification.manage',
} as const);

export type VerificationCapability = (typeof VERIFICATION_CAPABILITIES)[keyof typeof VERIFICATION_CAPABILITIES];
