import type { OperationInputFor, OperationOutputFor } from '@shop/contract';
import type { HandlerContext } from '../../../../foundation/application/HandlerContext';
import type { OperationHandler, OperationReply } from '../../../../foundation/application/OperationHandler';
import { keysetPage, queryPage } from '../../../../foundation/interface/Validation';
import { requireSession } from '../../../../foundation/security/OperationSecurityContext';
import type { NotificationRepository } from '../port/NotificationRepository';

export class AnnouncementsReadHandler implements OperationHandler<'notification.announcements.read', 'read'> {
  readonly operation = 'notification.announcements.read' as const;
  readonly mode = 'read' as const;
  constructor(private readonly notifications: NotificationRepository) {}
  async execute(input: OperationInputFor<'notification.announcements.read'>, context: HandlerContext<'notification.announcements.read'>): Promise<OperationReply<OperationOutputFor<'notification.announcements.read'>>> {
    const access = requireSession(context.security);
    const page = queryPage(input);
    const rows = await this.notifications.announcements(context.transaction, access.scope.id, page.id, page.fetch);
    const result = keysetPage(rows, page, 'id');
    return { status: 200, body: { ...result, items: [...result.items] } as OperationOutputFor<'notification.announcements.read'> };
  }
}
