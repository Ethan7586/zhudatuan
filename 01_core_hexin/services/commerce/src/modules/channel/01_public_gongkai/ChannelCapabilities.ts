export const CHANNEL_CAPABILITIES = Object.freeze({
  read: 'channel.read',
  manage: 'channel.manage',
} as const);

export type ChannelCapability = (typeof CHANNEL_CAPABILITIES)[keyof typeof CHANNEL_CAPABILITIES];
