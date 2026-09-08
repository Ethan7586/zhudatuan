import type { StorefrontSession } from '../../../entity/session';
import type { NotificationOperations } from '@shop/sdk/notification';
import type { RequestContextFactory } from '../../../shared/api/RequestContext';
import type { NotificationPreference } from '../model/NotificationPreference';
import type { NotificationPage } from '../model/Notification';
import { mapNotifications, mapPreferences } from './NotificationMapper';
import type { NotificationPort } from '../public/NotificationPort';
import { readCursorPages } from '../../../shared/api/CursorPage';

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
    const pages = await readCursorPages((cursor) => this.notification.preferencesRead({ query: { limit: 100, ...(cursor ? { cursor } : {}) } }, this.context(session, { signal })), signal);
    return Object.freeze(pages.flatMap(mapPreferences));
  }

  async changePreference(
    session: StorefrontSession,
    preference: NotificationPreference,
    change: Readonly<{ enabled: boolean; quietHours: Readonly<{ start: string; end: string; timezone: string }> | null }>,
    idempotencyKey: string
  ): Promise<void> {
    await this.notification.preferencesManage({ path: { channel: preference.channel, eventtype: preference.eventType }, body: change }, this.context(session, { write: true, idempotencyKey, expectedVersion: preference.version }));
  }
}
