export const QUALIFICATION_CAPABILITIES = Object.freeze({
  read: 'qualification.read',
  manage: 'qualification.manage',
} as const);

export type QualificationCapability =
  (typeof QUALIFICATION_CAPABILITIES)[keyof typeof QUALIFICATION_CAPABILITIES];
