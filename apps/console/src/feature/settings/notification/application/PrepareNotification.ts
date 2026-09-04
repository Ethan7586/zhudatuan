import { OP_NOTIFICATION_ANNOUNCEMENTS_MANAGE, OP_NOTIFICATION_TEMPLATES_MANAGE } from '@shop/contract/ids';
import { createActionRequest } from '../../../../shared/security/ActionRequest';
import type { ConsoleContext } from '../../../../entity/session/ConsoleSession';
import { announcementInput, templateInput, type NotificationCommand } from '../model/Command';

export class PrepareNotification {
  execute(context: ConsoleContext, command: NotificationCommand): Promise<string> {
    if (command.kind === 'template') return createActionRequest(OP_NOTIFICATION_TEMPLATES_MANAGE, templateInput(command.change), command.change.expectedVersion, context.session.membership, context.scope.id);
    return createActionRequest(OP_NOTIFICATION_ANNOUNCEMENTS_MANAGE, announcementInput(command.change), command.change.expectedVersion, context.session.membership, context.scope.id);
  }
}
