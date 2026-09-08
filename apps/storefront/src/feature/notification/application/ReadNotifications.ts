import type { StorefrontSession } from '../../../entity/session';
import type { NotificationPort } from '../public/NotificationPort';

export class ReadNotifications {
  constructor(private readonly gateway: Pick<NotificationPort, 'read'>) {}
  async execute(session: StorefrontSession, cursor?: string, signal?: AbortSignal) {
    return this.gateway.read(session, cursor, signal);
  }
}
