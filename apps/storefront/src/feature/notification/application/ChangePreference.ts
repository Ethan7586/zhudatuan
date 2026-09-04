import type { StorefrontSession } from '../../../entity/session';
import type { NotificationPort } from '../public/NotificationPort';
import type { NotificationPreference } from '../model/NotificationPreference';

export class ChangePreference {
  constructor(private readonly gateway: Pick<NotificationPort, 'changePreference'>) {}
  async execute(session: StorefrontSession, preference: NotificationPreference, change: Readonly<{ enabled?: boolean; quietHours?: Readonly<{ start: string; end: string; timezone: string }> | null }>): Promise<void> {
    const enabled = change.enabled ?? preference.enabled;
    const authorization = preference.channel === 'wechat' ? (enabled ? 'accepted' : 'rejected') : undefined;
    const quietHours = change.quietHours === undefined
      ? preference.quietStart && preference.quietEnd && preference.quietTimezone ? { start: preference.quietStart.slice(0, 5), end: preference.quietEnd.slice(0, 5), timezone: preference.quietTimezone } : null
      : change.quietHours;
    await this.gateway.changePreference(session, preference, { enabled, ...(authorization ? { authorization } : {}), quietHours },
      `preference:${preference.channel}:${preference.eventType}:${crypto.randomUUID()}`);
  }
}
