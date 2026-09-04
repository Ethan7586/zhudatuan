import type { StorefrontSession } from '../../../entity/session';
import type { NotificationChannel, NotificationPage } from '../model/Notification';
import type { NotificationAuthorization, NotificationPreference } from '../model/NotificationPreference';

export interface NotificationPort {
  read(session: StorefrontSession, cursor?: string, signal?: AbortSignal): Promise<NotificationPage>;
  acknowledge(session: StorefrontSession, notificationId: string, idempotencyKey: string): Promise<string>;
  preferences(session: StorefrontSession, signal?: AbortSignal): Promise<readonly NotificationPreference[]>;
  changePreference(session: StorefrontSession, preference: NotificationPreference, change: Readonly<{ enabled: boolean; authorization?: NotificationAuthorization; quietHours: Readonly<{ start: string; end: string; timezone: string }> | null }>, idempotencyKey: string): Promise<void>;
}
