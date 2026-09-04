import type { StorefrontSession } from '../../../entity/session';
import type { NotificationChannel, NotificationPage } from '../model/Notification';
import type { NotificationAuthorization, NotificationPreference } from '../model/NotificationPreference';

export interface NotificationPort {
  read(session: StorefrontSession, cursor?: string, signal?: AbortSignal): Promise<NotificationPage>;
  acknowledge(session: StorefrontSession, notificationId: string, idempotencyKey: string): Promise<string>;
  preferences(session: StorefrontSession, signal?: AbortSignal): Promise<readonly NotificationPreference[]>;
  changePreference(session: StorefrontSession, channel: NotificationChannel, eventType: string, enabled: boolean, authorization: NotificationAuthorization | undefined, idempotencyKey: string): Promise<void>;
}
