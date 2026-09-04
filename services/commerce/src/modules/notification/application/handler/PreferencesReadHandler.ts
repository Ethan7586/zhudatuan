import type { OperationInputFor, OperationOutputFor } from '@shop/contract';
import type { HandlerContext } from '../../../../foundation/application/HandlerContext';
import type { OperationHandler, OperationReply } from '../../../../foundation/application/OperationHandler';
import { keysetPage, queryPage } from '../../../../foundation/application/Validation';
import { requireSession } from '../../../../foundation/security/OperationSecurityContext';
import type { NotificationRepository } from '../port/NotificationRepository';

export class PreferencesReadHandler implements OperationHandler<'notification.preferences.read', 'read'> {
  readonly operation = 'notification.preferences.read' as const;
  readonly mode = 'read' as const;
  constructor(private readonly notifications: NotificationRepository) {}
  async execute(input: OperationInputFor<'notification.preferences.read'>, context: HandlerContext<'notification.preferences.read'>): Promise<OperationReply<OperationOutputFor<'notification.preferences.read'>>> {
    const access = requireSession(context.security);
    const member = await this.notifications.member(context.transaction, access.membership.id);
    const page = queryPage(input);
    const rows = await this.notifications.preferences(context.transaction, member.member, member.organization, page.id, page.fetch);
    const result = keysetPage(rows, page, 'cursor_id', 'cursor_id');
    return { status: 200, body: { ...result, items: [...result.items] } as OperationOutputFor<'notification.preferences.read'> };
  }
}
