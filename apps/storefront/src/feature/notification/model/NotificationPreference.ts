import type { NotificationChannel } from './Notification';

export type NotificationAuthorization = 'unknown' | 'accepted' | 'rejected';

export interface NotificationPreference {
  readonly channel: NotificationChannel;
  readonly eventType: string;
  readonly providerTemplate: string | null;
  readonly enabled: boolean;
  readonly authorization: NotificationAuthorization;
  readonly authorizedAt: string | null;
}
