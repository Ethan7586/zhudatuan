import { OP_NOTIFICATION_ANNOUNCEMENTS_READ, OP_NOTIFICATION_TEMPLATES_READ } from '@shop/contract/ids';
import type { ConsoleContext } from '../../../../entity/session/ConsoleSession';
import { assertOperationAccess } from '../../../../shared/security/OperationAccess';
import type { NotificationChannel } from '../model/Template';
import type { NotificationPort } from '../public';

export class ReadNotifications {
  constructor(private readonly port: NotificationPort) {}
  templates(context: ConsoleContext, channel?: NotificationChannel, cursor?: string, signal?: AbortSignal) {
    assertOperationAccess(context, OP_NOTIFICATION_TEMPLATES_READ);
    return this.port.readTemplates(context, channel, cursor, signal);
  }
  announcements(context: ConsoleContext, cursor?: string, signal?: AbortSignal) {
    assertOperationAccess(context, OP_NOTIFICATION_ANNOUNCEMENTS_READ);
    return this.port.readAnnouncements(context, cursor, signal);
  }
}
