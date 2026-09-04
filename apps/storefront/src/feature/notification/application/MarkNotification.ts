import type { StorefrontSession } from '../../../entity/session';
import type { NotificationPort } from '../public/NotificationPort';

export class MarkNotification {
  constructor(private readonly gateway: Pick<NotificationPort, 'acknowledge'>) {}
  async execute(session: StorefrontSession, notificationId: string): Promise<string> {
    return this.gateway.acknowledge(session, notificationId, `notification:${notificationId}:ack`);
  }
}
