import type { StorefrontSession } from '../../../shared/api/Session';
import { storefrontClient } from '../../../shared/api/Client';
import type { NotificationChannel } from '../model/Notification';
import type { NotificationAuthorization, NotificationPreference } from '../model/NotificationPreference';
import type { NotificationPage } from '../model/Notification';
import { mapNotifications, mapPreferences } from './NotificationMapper';

export const NotificationGateway = Object.freeze({
  async read(session: StorefrontSession, cursor?: string, signal?: AbortSignal): Promise<NotificationPage> {
    const value = await storefrontClient.commerce.notification.notificationsRead({ query: { limit: 50, ...(cursor ? { cursor } : {}) } }, storefrontClient.context(session, { signal }));
    return mapNotifications(value);
  },

  async acknowledge(session: StorefrontSession, notificationId: string, idempotencyKey: string): Promise<string> {
    const value = await storefrontClient.commerce.notification.notificationsAck({ path: { notificationid: notificationId }, body: {} }, storefrontClient.context(session, { write: true, idempotencyKey }));
    return value.readAt;
  },

  async preferences(session: StorefrontSession, signal?: AbortSignal): Promise<readonly NotificationPreference[]> {
    const value = await storefrontClient.commerce.notification.preferencesRead({ query: { limit: 100 } }, storefrontClient.context(session, { signal }));
    return mapPreferences(value);
  },

  async changePreference(session: StorefrontSession, channel: NotificationChannel, eventType: string, enabled: boolean, authorization: NotificationAuthorization | undefined, idempotencyKey: string): Promise<void> {
    await storefrontClient.commerce.notification.preferencesManage(
      { path: { channel, eventtype: eventType }, body: { enabled, ...(authorization ? { authorization } : {}) } },
      storefrontClient.context(session, { write: true, idempotencyKey })
    );
  },
});
