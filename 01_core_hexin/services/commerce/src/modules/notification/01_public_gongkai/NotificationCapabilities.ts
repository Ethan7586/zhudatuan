export const NOTIFICATION_CAPABILITIES = Object.freeze({
  read: 'notification.read',
  manage: 'notification.manage',
} as const);

export type NotificationCapability = (typeof NOTIFICATION_CAPABILITIES)[keyof typeof NOTIFICATION_CAPABILITIES];
