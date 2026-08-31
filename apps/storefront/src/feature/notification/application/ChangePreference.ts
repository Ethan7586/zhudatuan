import type { StorefrontSession } from '../../../shared/api/Session';
import { NotificationGateway } from '../infrastructure/NotificationGateway';
import type { NotificationChannel } from '../model/Notification';

export class ChangePreference {
  async execute(session: StorefrontSession, channel: NotificationChannel, eventType: string, enabled: boolean): Promise<void> {
    const authorization = channel === 'wechat' ? (enabled ? 'accepted' : 'rejected') : undefined;
    await NotificationGateway.changePreference(session, channel, eventType, enabled, authorization, `preference:${channel}:${eventType}:${enabled}:${crypto.randomUUID()}`);
  }
}
