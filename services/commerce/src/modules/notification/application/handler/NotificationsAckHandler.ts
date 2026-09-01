import type { OperationInputFor, OperationOutputFor } from '@shop/contract';
import { DomainError } from '../../../../foundation/domain/DomainError';
import type { WriteHandlerContext } from '../../../../foundation/application/HandlerContext';
import type { OperationHandler, OperationReply } from '../../../../foundation/application/OperationHandler';
import { requireSession } from '../../../../foundation/security/OperationSecurityContext';
import type { NotificationRepository } from '../port/NotificationRepository';

export class NotificationsAckHandler implements OperationHandler<'notification.notifications.ack', 'write'> {
  readonly operation = 'notification.notifications.ack' as const;
  readonly mode = 'write' as const;
  constructor(private readonly notifications: NotificationRepository) {}
  async execute(input: OperationInputFor<'notification.notifications.ack'>, context: WriteHandlerContext<'notification.notifications.ack'>): Promise<OperationReply<OperationOutputFor<'notification.notifications.ack'>>> {
    const access = requireSession(context.security);
    const row = await this.notifications.acknowledge(context.transaction, access.membership.id, input.path.notificationid);
    if (!row) throw new DomainError('RESOURCE_NOT_FOUND');
    return { status: 200, body: row as OperationOutputFor<'notification.notifications.ack'> };
  }
}
