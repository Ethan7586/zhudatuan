import type { StorefrontSession } from '../../../entity/session';
import { NotificationGateway } from '../infrastructure/NotificationGateway';

export class ReadNotifications {
  constructor(private readonly gateway: Pick<NotificationGateway, 'read' | 'preferences'>) {}
  async execute(session: StorefrontSession, cursor?: string, signal?: AbortSignal) {
    const [notifications, preferences] = await Promise.all([this.gateway.read(session, cursor, signal), this.gateway.preferences(session, signal)]);
    return Object.freeze({ notifications, preferences });
  }
}
