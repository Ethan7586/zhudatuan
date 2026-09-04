import type { OperationActions } from '../../../../foundation/application/ModuleOperations';
import { requireAccess, rowResult } from '../../../../foundation/application/ModuleOperations';
import { bodyRecord, integerField, textField } from '../../../../foundation/interface/Validation';
import { Template, type DeliveryChannelId } from '../../02_domain_yewu/model/Template';
import type { NotificationRepositoryFactory } from './ChangePreference';

export function saveTemplateOperations(repositories: NotificationRepositoryFactory): OperationActions {
  return {
    'notification.templates.manage': async (request, database) => {
      const access = requireAccess(request); const body = bodyRecord(request); const id = request.input.path.templateid!;
      const template = new Template(id, access.scope.id, channel(body.channel), textField(body, 'eventType'),
        integerField(body, 'version', 1), object(body.variables), nullable(body.providerTemplate, 500), nullable(body.subject, 500),
        textField(body, 'body', 10_000), state(body.status));
      const result = await repositories(database).saveTemplate({ id: template.id, scope_id: template.scope, channel: template.channel,
        event_type: template.event, version: template.version, variable_schema: template.variables, provider_template: template.providerTemplate,
        subject: template.subject, body: template.body, status: template.state });
      if (!result.rows[0]) throw new Error('NOTIFICATION_TEMPLATE_ID_CONFLICT');
      if (!result.rows[0].matches) throw new Error('NOTIFICATION_TEMPLATE_IMMUTABLE_OR_TRANSITION_INVALID');
      return rowResult(result, result.rows[0].inserted ? 201 : 200);
    },
  };
}

function channel(value: unknown): DeliveryChannelId {
  if (!['sms', 'email', 'wechat', 'inapp'].includes(String(value))) throw new Error('NOTIFICATION_CHANNEL_INVALID'); return value as DeliveryChannelId;
}
function state(value: unknown): 'draft' | 'active' | 'retired' {
  const selected = value ?? 'draft'; if (!['draft', 'active', 'retired'].includes(String(selected))) throw new Error('NOTIFICATION_TEMPLATE_STATE_INVALID');
  return selected as 'draft' | 'active' | 'retired';
}
function object(value: unknown): Readonly<Record<string, unknown>> {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) throw new Error('JSON_OBJECT_REQUIRED'); return value as Record<string, unknown>;
}
function nullable(value: unknown, maximum: number): string | null {
  if (value === undefined || value === null) return null;
  if (typeof value !== 'string' || value.length > maximum) throw new Error('NOTIFICATION_TEMPLATE_FIELD_INVALID'); return value;
}
