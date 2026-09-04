export const ACCESS_CAPABILITIES = Object.freeze({
  read: 'access.read',
  manage: 'access.manage',
});

export type AccessCapability = (typeof ACCESS_CAPABILITIES)[keyof typeof ACCESS_CAPABILITIES];
