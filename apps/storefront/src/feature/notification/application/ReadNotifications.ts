import type { StorefrontSession } from '../../../shared/api/Session';
import { NotificationGateway } from '../infrastructure/NotificationGateway';

export async function readNotifications(session: StorefrontSession, cursor?: string, signal?: AbortSignal) {
  const [notifications, preferences] = await Promise.all([NotificationGateway.read(session, cursor, signal), NotificationGateway.preferences(session, signal)]);
  return Object.freeze({ notifications, preferences });
}
