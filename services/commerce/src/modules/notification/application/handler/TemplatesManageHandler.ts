import type { OperationInputFor, OperationOutputFor } from '@shop/contract';
import type { WriteHandlerContext } from '../../../../pipeline/HandlerContext';
import type { OperationHandler, OperationReply } from '../../../../pipeline/OperationHandler';
import { bodyRecord, integerField, textField } from '../../../../pipeline/Validation';
import { requireSession } from '../../../../platform/security/OperationSecurityContext';
import { Template, type DeliveryChannelId } from '../../domain/model/Template';
import type { NotificationRepository } from '../port/NotificationRepository';

export class TemplatesManageHandler implements OperationHandler<'notification.templates.manage', 'write'> {
  readonly operation = 'notification.templates.manage' as const;
  readonly mode = 'write' as const;
  constructor(private readonly notifications: NotificationRepository) {}
  async execute(input: OperationInputFor<'notification.templates.manage'>, context: WriteHandlerContext<'notification.templates.manage'>): Promise<OperationReply<OperationOutputFor<'notification.templates.manage'>>> {
    const access = requireSession(context.security);
    const body = bodyRecord(input);
    const template = new Template(
      input.path.templateid,
      access.scope.id,
      channel(body.channel),
      textField(body, 'eventType'),
      integerField(body, 'version', 1),
      object(body.variables),
      nullable(body.providerTemplate, 500),
      nullable(body.subject, 500),
      textField(body, 'body', 10_000),
      state(body.status),
      purpose(body.purpose),
      mandatory(body.mandatory)
    );
    const saved = await this.notifications.saveTemplate(context.transaction, {
      id: template.id,
      scopeId: template.scope,
      channel: template.channel,
      eventType: template.event,
      version: template.version,
      variableSchema: template.variables,
      providerTemplate: template.providerTemplate,
      subject: template.subject,
      body: template.body,
      purpose: template.purpose,
      mandatory: template.mandatory,
      status: template.state,
      expectedVersion: context.expectedVersion ?? 0,
    });
    if (!saved) throw new Error('NOTIFICATION_TEMPLATE_ID_CONFLICT');
    if (!saved.matches) throw new Error('NOTIFICATION_TEMPLATE_IMMUTABLE_OR_TRANSITION_INVALID');
    return {
      status: saved.inserted ? 201 : 200,
      body: {
        id: saved.id,
        scope_id: saved.scopeId,
        channel: saved.channel,
        event_type: saved.eventType,
        version: saved.version,
        variable_schema: saved.variableSchema,
        provider_template: saved.providerTemplate,
        subject: saved.subject,
        body: saved.body,
        status: saved.status,
        created_at: saved.createdAt,
        matches: saved.matches,
        inserted: saved.inserted,
      } as OperationOutputFor<'notification.templates.manage'>,
    };
  }
}
function purpose(value: unknown): 'transactional' | 'marketing' {
  const selected = value ?? 'transactional';
  if (!['transactional', 'marketing'].includes(String(selected))) throw new Error('NOTIFICATION_TEMPLATE_PURPOSE_INVALID');
  return selected as 'transactional' | 'marketing';
}
function mandatory(value: unknown): boolean {
  if (value === undefined) return false;
  if (typeof value !== 'boolean') throw new Error('NOTIFICATION_TEMPLATE_PURPOSE_INVALID');
  return value;
}

function channel(value: unknown): DeliveryChannelId {
  if (!['sms', 'email', 'wechat', 'inapp'].includes(String(value))) throw new Error('NOTIFICATION_CHANNEL_INVALID');
  return value as DeliveryChannelId;
}
function state(value: unknown): 'draft' | 'active' | 'retired' {
  const selected = value ?? 'draft';
  if (!['draft', 'active', 'retired'].includes(String(selected))) throw new Error('NOTIFICATION_TEMPLATE_STATE_INVALID');
  return selected as 'draft' | 'active' | 'retired';
}
function object(value: unknown): Readonly<Record<string, unknown>> {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) throw new Error('JSON_OBJECT_REQUIRED');
  return value as Record<string, unknown>;
}
function nullable(value: unknown, maximum: number): string | null {
  if (value === undefined || value === null) return null;
  if (typeof value !== 'string' || value.length > maximum) throw new Error('NOTIFICATION_TEMPLATE_FIELD_INVALID');
  return value;
}
