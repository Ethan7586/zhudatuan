import type { StorefrontSession } from '../../../entity/session';
import { NotificationGateway } from '../infrastructure/NotificationGateway';

export class MarkNotification {
  constructor(private readonly gateway: Pick<NotificationGateway, 'acknowledge'>) {}
  async execute(session: StorefrontSession, notificationId: string): Promise<string> {
    return this.gateway.acknowledge(session, notificationId, `notification:${notificationId}:ack`);
  }
}
