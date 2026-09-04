import type { StorefrontSession } from '../../../entity/session';
import type { NotificationPort } from '../public/NotificationPort';
import type { NotificationChannel } from '../model/Notification';

export class ChangePreference {
  constructor(private readonly gateway: Pick<NotificationPort, 'changePreference'>) {}
  async execute(session: StorefrontSession, channel: NotificationChannel, eventType: string, enabled: boolean): Promise<void> {
    const authorization = channel === 'wechat' ? (enabled ? 'accepted' : 'rejected') : undefined;
    await this.gateway.changePreference(session, channel, eventType, enabled, authorization, `preference:${channel}:${eventType}:${enabled}:${crypto.randomUUID()}`);
  }
}
