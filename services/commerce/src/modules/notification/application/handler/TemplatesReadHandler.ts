import type { OperationInputFor, OperationOutputFor } from '@shop/contract';
import type { HandlerContext } from '../../../../foundation/application/HandlerContext';
import type { OperationHandler, OperationReply } from '../../../../foundation/application/OperationHandler';
import { keysetPage, queryPage } from '../../../../foundation/interface/Validation';
import { requireSession } from '../../../../foundation/security/OperationSecurityContext';
import type { NotificationRepository } from '../port/NotificationRepository';
import type { DeliveryChannelId } from '../../domain/model/Template';

export class TemplatesReadHandler implements OperationHandler<'notification.templates.read', 'read'> {
  readonly operation = 'notification.templates.read' as const;
  readonly mode = 'read' as const;
  constructor(private readonly notifications: NotificationRepository) {}
  async execute(input: OperationInputFor<'notification.templates.read'>, context: HandlerContext<'notification.templates.read'>): Promise<OperationReply<OperationOutputFor<'notification.templates.read'>>> {
    const access = requireSession(context.security);
    const page = queryPage(input);
    const rows = (await this.notifications.templates(context.transaction, access.scope.id, channel(input.query?.channel), page.id, page.fetch)).map((row) => ({
      id: row.id,
      scope_id: row.scopeId,
      channel: row.channel,
      event_type: row.eventType,
      version: row.version,
      variable_schema: row.variableSchema,
      provider_template: row.providerTemplate,
      subject: row.subject,
      body: row.body,
      status: row.status,
      created_at: row.createdAt,
    }));
    const result = keysetPage(rows, page, 'id');
    return { status: 200, body: { ...result, items: [...result.items] } as OperationOutputFor<'notification.templates.read'> };
  }
}

function channel(value: unknown): DeliveryChannelId | null {
  if (value === undefined) return null;
  if (!['sms', 'email', 'wechat', 'inapp'].includes(String(value))) throw new Error('NOTIFICATION_CHANNEL_INVALID');
  return value as DeliveryChannelId;
}
