import { createHash } from 'node:crypto';
import { Preference, type QuietHours } from '../../domain/model/Preference';
import type { DeliveryChannelId } from '../../domain/model/Template';

export function preferenceFor(
  member: string,
  record: Readonly<{
    channel: DeliveryChannelId;
    event_type: string;
    preference_enabled: boolean;
    authorization_state: 'unknown' | 'accepted' | 'rejected';
    consent_source: 'member' | 'provider' | 'operator' | 'system';
    quiet_start: string | null;
    quiet_end: string | null;
    quiet_timezone: string | null;
    preference_version: number;
  }>
): Preference {
  return new Preference(member, record.channel, record.event_type, record.preference_enabled, record.authorization_state, record.consent_source, quietHours(record), record.preference_version);
}

export function quietHours(record: Readonly<{ quiet_start: string | null; quiet_end: string | null; quiet_timezone: string | null }>): QuietHours | null {
  if (record.quiet_start === null && record.quiet_end === null && record.quiet_timezone === null) return null;
  if (record.quiet_start === null || record.quiet_end === null || record.quiet_timezone === null) throw new Error('NOTIFICATION_QUIET_HOURS_INVALID');
  return Object.freeze({ start: record.quiet_start.slice(0, 5), end: record.quiet_end.slice(0, 5), timezone: record.quiet_timezone });
}

export function optionalText(value: unknown): string | null {
  if (value === undefined || value === null) return null;
  if (typeof value !== 'string' || !value) throw new Error('NOTIFICATION_MEMBER_INVALID');
  return value;
}
export function required(value: string | null): string {
  if (!value) throw new Error('NOTIFICATION_RECIPIENT_MISSING');
  return value;
}
export function digest(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}
export function deliveryError(value: unknown): string {
  const message = value instanceof Error ? value.message : 'NOTIFICATION_DELIVERY_FAILED';
  return /^[A-Z][A-Z0-9_.:-]{2,199}$/.test(message) ? message : 'NOTIFICATION_DELIVERY_FAILED';
}
export function definitiveProviderRejection(code: string): boolean {
  return code === 'ALIYUN_SMS_REJECTED' || code.startsWith('ALIYUN_SMS_ISV.');
}
