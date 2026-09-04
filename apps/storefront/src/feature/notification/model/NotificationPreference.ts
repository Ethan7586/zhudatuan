import type { NotificationChannel } from './Notification';
import type { OperationOutputFor } from '@shop/contract';

type PreferenceDto = OperationOutputFor<'notification.preferences.read'>['items'][number];
export type NotificationAuthorization = PreferenceDto['authorization_state'];
export type NotificationConsentSource = PreferenceDto['consent_source'];

export interface NotificationPreference {
  readonly channel: NotificationChannel;
  readonly eventType: string;
  readonly providerTemplate: string | null;
  readonly enabled: boolean;
  readonly authorization: NotificationAuthorization;
  readonly authorizedAt: string | null;
  readonly consentSource: NotificationConsentSource;
  readonly quietStart: string | null;
  readonly quietEnd: string | null;
  readonly quietTimezone: string | null;
  readonly version: number;
}
