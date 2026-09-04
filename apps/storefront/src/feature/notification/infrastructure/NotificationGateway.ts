import type { StorefrontSession } from '../../../entity/session';
import type { NotificationOperations } from '@shop/sdk/notification';
import type { RequestContextFactory } from '../../../shared/api/RequestContext';
import type { NotificationChannel } from '../model/Notification';
import type { NotificationAuthorization, NotificationPreference } from '../model/NotificationPreference';
import type { NotificationPage } from '../model/Notification';
import { mapNotifications, mapPreferences } from './NotificationMapper';
import type { NotificationPort } from '../public/NotificationPort';

export class NotificationGateway implements NotificationPort {
  constructor(
    private readonly notification: NotificationOperations,
    private readonly context: RequestContextFactory
  ) {}
  async read(session: StorefrontSession, cursor?: string, signal?: AbortSignal): Promise<NotificationPage> {
    const value = await this.notification.notificationsRead({ query: { limit: 50, ...(cursor ? { cursor } : {}) } }, this.context(session, { signal }));
    return mapNotifications(value);
  }

  async acknowledge(session: StorefrontSession, notificationId: string, idempotencyKey: string): Promise<string> {
    const value = await this.notification.notificationsAck({ path: { notificationid: notificationId }, body: {} }, this.context(session, { write: true, idempotencyKey }));
    return value.readAt;
  }

  async preferences(session: StorefrontSession, signal?: AbortSignal): Promise<readonly NotificationPreference[]> {
    const value = await this.notification.preferencesRead({ query: { limit: 100 } }, this.context(session, { signal }));
    return mapPreferences(value);
  }

  async changePreference(session: StorefrontSession, channel: NotificationChannel, eventType: string, enabled: boolean, authorization: NotificationAuthorization | undefined, idempotencyKey: string): Promise<void> {
    await this.notification.preferencesManage({ path: { channel, eventtype: eventType }, body: { enabled, ...(authorization ? { authorization } : {}) } }, this.context(session, { write: true, idempotencyKey }));
  }
}
