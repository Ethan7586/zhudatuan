import type { OperationInputFor, OperationOutputFor } from '@shop/contract';
import type { HandlerContext } from '../../../../foundation/application/HandlerContext';
import type { OperationHandler, OperationReply } from '../../../../foundation/application/OperationHandler';
import { keysetPage, queryPage } from '../../../../foundation/interface/Validation';
import { requireSession } from '../../../../foundation/security/OperationSecurityContext';
import type { NotificationRepository } from '../port/NotificationRepository';

export class NotificationsReadHandler implements OperationHandler<'notification.notifications.read', 'read'> {
  readonly operation = 'notification.notifications.read' as const;
  readonly mode = 'read' as const;
  constructor(private readonly notifications: NotificationRepository) {}
  async execute(input: OperationInputFor<'notification.notifications.read'>, context: HandlerContext<'notification.notifications.read'>): Promise<OperationReply<OperationOutputFor<'notification.notifications.read'>>> {
    const access = requireSession(context.security);
    const page = queryPage(input);
    const rows = await this.notifications.notifications(context.transaction, access.membership.id, access.actor.target !== 'storefront', page.sort, page.id, page.fetch);
    const result = keysetPage(rows, page, 'created_at');
    return { status: 200, body: { ...result, items: [...result.items] } as OperationOutputFor<'notification.notifications.read'> };
  }
}
