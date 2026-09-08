import type { StorefrontSession } from '../../../entity/session';
import type { NotificationPort } from '../public/NotificationPort';

export class ReadPreferences {
  constructor(private readonly gateway: Pick<NotificationPort, 'preferences'>) {}
  execute(session: StorefrontSession, signal?: AbortSignal) {
    return this.gateway.preferences(session, signal);
  }
}
