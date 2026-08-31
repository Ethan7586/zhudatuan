export type NotificationKind = 'dispatch' | 'announcement';
export type NotificationChannel = 'sms' | 'email' | 'wechat' | 'inapp';

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
