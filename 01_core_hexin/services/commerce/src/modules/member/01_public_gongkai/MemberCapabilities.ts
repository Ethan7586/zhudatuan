export const MEMBER_CAPABILITIES = Object.freeze({
  read: 'member.read',
  manage: 'member.manage',
});

export type MemberCapability = (typeof MEMBER_CAPABILITIES)[keyof typeof MEMBER_CAPABILITIES];
