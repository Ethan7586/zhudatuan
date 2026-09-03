import type { StorefrontSession } from '../../../entity/session';
import { NotificationGateway } from '../infrastructure/NotificationGateway';
import type { NotificationChannel } from '../model/Notification';

export class ChangePreference {
  constructor(private readonly gateway: Pick<NotificationGateway, 'changePreference'>) {}
  async execute(session: StorefrontSession, channel: NotificationChannel, eventType: string, enabled: boolean): Promise<void> {
    const authorization = channel === 'wechat' ? (enabled ? 'accepted' : 'rejected') : undefined;
    await this.gateway.changePreference(session, channel, eventType, enabled, authorization, `preference:${channel}:${eventType}:${enabled}:${crypto.randomUUID()}`);
  }
}
