import { OP_NOTIFICATION_ANNOUNCEMENTS_MANAGE } from '@shop/contract/ids';
import type { ConsoleContext } from '../../../../entity/session/ConsoleSession';
import { assertOperationAccess } from '../../../../shared/security/OperationAccess';
import type { AnnouncementChange } from '../model/Announcement';
import type { NotificationPort } from '../public';

export class ManageAnnouncement {
  constructor(private readonly port: NotificationPort) {}
  execute(context: ConsoleContext, change: AnnouncementChange, proof: string, identity: string, signal?: AbortSignal) {
    assertOperationAccess(context, OP_NOTIFICATION_ANNOUNCEMENTS_MANAGE, proof);
    return this.port.manageAnnouncement(context, change, proof, identity, signal);
  }
}
