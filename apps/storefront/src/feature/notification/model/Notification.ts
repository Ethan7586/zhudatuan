import type { OperationOutputFor } from '@shop/contract';

type NotificationDto = OperationOutputFor<'notification.notifications.read'>['items'][number];
export type NotificationKind = NotificationDto['kind'];
export type NotificationChannel = NotificationDto['channel'];

export interface Notification {
  readonly id: string;
  readonly kind: NotificationKind;
  readonly eventType: string;
  readonly channel: NotificationChannel;
  readonly subject: string | null;
  readonly body: string;
  readonly state: string;
  readonly createdAt: string;
  readonly readAt: string | null;
}

export interface NotificationPage {
  readonly items: readonly Notification[];
  readonly nextCursor: string | null;
}
