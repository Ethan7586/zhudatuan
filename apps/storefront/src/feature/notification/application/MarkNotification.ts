import type { StorefrontSession } from '../../../shared/api/Session';
import { NotificationGateway } from '../infrastructure/NotificationGateway';

export class MarkNotification {
  async execute(session: StorefrontSession, notificationId: string): Promise<string> {
    return NotificationGateway.acknowledge(session, notificationId, `notification:${notificationId}:ack`);
  }
}
