import { DELIVERY_CHANNELS, type DeliveryChannelId } from './Template';

export type AuthorizationState = 'unknown' | 'accepted' | 'rejected';
export type ConsentSource = 'member' | 'provider' | 'operator' | 'system';
export interface QuietHours {
  readonly start: string;
  readonly end: string;
  readonly timezone: string;
}
export type PreferenceDecision = Readonly<{ kind: 'allow' } | { kind: 'block'; reason: 'authorization' | 'unsubscribe' } | { kind: 'defer'; availableAt: string }>;

export class Preference {
  constructor(
    readonly member: string,
    readonly channel: DeliveryChannelId,
    readonly event: string,
    readonly enabled: boolean,
    readonly authorization: AuthorizationState = 'unknown',
    readonly consentSource: ConsentSource = 'member',
    readonly quietHours: QuietHours | null = null,
    readonly version = 0
  ) {
    if (
      !member ||
      !DELIVERY_CHANNELS.includes(channel) ||
      !/^[a-z][a-z0-9.]{1,127}$/.test(event) ||
      !['unknown', 'accepted', 'rejected'].includes(authorization) ||
      !['member', 'provider', 'operator', 'system'].includes(consentSource) ||
      !Number.isSafeInteger(version) ||
      version < 0
    )
      throw new Error('NOTIFICATION_PREFERENCE_INVALID');
    if (channel === 'wechat' && enabled && authorization === 'rejected') throw new Error('NOTIFICATION_SUBSCRIPTION_REJECTED');
    if (quietHours !== null) validateQuietHours(quietHours);
    Object.freeze(this);
  }

  allows(purpose: 'transactional' | 'marketing', mandatory: boolean, at: Date): boolean {
    return this.decide(purpose, mandatory, at).kind === 'allow';
  }

  decide(purpose: 'transactional' | 'marketing', mandatory: boolean, at: Date): PreferenceDecision {
    if (this.channel === 'wechat' && this.authorization !== 'accepted') return Object.freeze({ kind: 'block', reason: 'authorization' });
    if (!this.enabled && (purpose === 'marketing' || !mandatory)) return Object.freeze({ kind: 'block', reason: 'unsubscribe' });
    if (this.quietHours !== null && !mandatory && withinQuietHours(this.quietHours, at)) {
      return Object.freeze({ kind: 'defer', availableAt: nextAllowedAt(this.quietHours, at) });
    }
    return Object.freeze({ kind: 'allow' });
  }
}

export function withinQuietHours(quiet: QuietHours, at: Date): boolean {
  if (Number.isNaN(at.getTime())) throw new Error('NOTIFICATION_QUIET_TIME_INVALID');
  const parts = new Intl.DateTimeFormat('en-GB', { timeZone: quiet.timezone, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(at);
  const hour = Number(parts.find(({ type }) => type === 'hour')?.value);
  const minute = Number(parts.find(({ type }) => type === 'minute')?.value);
  const current = hour * 60 + minute;
  const start = minutes(quiet.start);
  const end = minutes(quiet.end);
  return start < end ? current >= start && current < end : current >= start || current < end;
}

export function nextAllowedAt(quiet: QuietHours, at: Date): string {
  const candidate = new Date(at);
  candidate.setUTCSeconds(0, 0);
  for (let minute = 1; minute <= 1_500; minute += 1) {
    candidate.setUTCMinutes(candidate.getUTCMinutes() + 1);
    if (!withinQuietHours(quiet, candidate)) return candidate.toISOString();
  }
  throw new Error('NOTIFICATION_QUIET_HOURS_UNRESOLVED');
}

function validateQuietHours(value: QuietHours): void {
  if (minutes(value.start) === minutes(value.end)) throw new Error('NOTIFICATION_QUIET_HOURS_INVALID');
  try {
    new Intl.DateTimeFormat('en', { timeZone: value.timezone }).format(new Date(0));
  } catch {
    throw new Error('NOTIFICATION_QUIET_HOURS_INVALID');
  }
  Object.freeze(value);
}

function minutes(value: string): number {
  const match = /^(?:[01]\d|2[0-3]):[0-5]\d$/.exec(value);
  if (!match) throw new Error('NOTIFICATION_QUIET_HOURS_INVALID');
  const [hour, minute] = value.split(':').map(Number);
  return hour! * 60 + minute!;
}
