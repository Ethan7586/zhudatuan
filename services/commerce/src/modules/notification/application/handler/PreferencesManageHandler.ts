import type { OperationInputFor, OperationOutputFor } from '@shop/contract';
import { DomainError } from '../../../../foundation/domain/DomainError';
import type { WriteHandlerContext } from '../../../../foundation/application/HandlerContext';
import type { OperationHandler, OperationReply } from '../../../../foundation/application/OperationHandler';
import { bodyRecord } from '../../../../foundation/interface/Validation';
import { requireSession } from '../../../../foundation/security/OperationSecurityContext';
import { Preference, type AuthorizationState } from '../../domain/model/Preference';
import { DELIVERY_CHANNELS, type DeliveryChannelId } from '../../domain/model/Template';
import type { NotificationRepository } from '../port/NotificationRepository';

export class PreferencesManageHandler implements OperationHandler<'notification.preferences.manage', 'write'> {
  readonly operation = 'notification.preferences.manage' as const;
  readonly mode = 'write' as const;
  constructor(private readonly notifications: NotificationRepository) {}
  async execute(input: OperationInputFor<'notification.preferences.manage'>, context: WriteHandlerContext<'notification.preferences.manage'>): Promise<OperationReply<OperationOutputFor<'notification.preferences.manage'>>> {
    const access = requireSession(context.security);
    const member = await this.notifications.member(context.transaction, access.membership.id);
    const channel = channelId(input.path.channel);
    const event = eventType(input.path.eventtype);
    const body = bodyRecord(input);
    const enabled = boolean(body.enabled);
    const authorization = channel === 'wechat' ? authorizationState(body.authorization) : 'unknown';
    new Preference(member.member, channel, event, enabled, authorization);
    const row = await this.notifications.changePreference(context.transaction, member.member, member.organization, channel, event, enabled, authorization);
    if (!row) throw new DomainError('RESOURCE_NOT_FOUND');
    return { status: 200, body: row as OperationOutputFor<'notification.preferences.manage'> };
  }
}

function channelId(value: unknown): DeliveryChannelId {
  if (typeof value !== 'string' || !DELIVERY_CHANNELS.includes(value as DeliveryChannelId)) throw new Error('NOTIFICATION_CHANNEL_INVALID');
  return value as DeliveryChannelId;
}
function eventType(value: unknown): string {
  if (typeof value !== 'string' || !/^[a-z][a-z0-9.]{1,127}$/.test(value)) throw new Error('NOTIFICATION_EVENT_INVALID');
  return value;
}
function authorizationState(value: unknown): AuthorizationState {
  if (!['accepted', 'rejected'].includes(String(value))) throw new Error('NOTIFICATION_AUTHORIZATION_INVALID');
  return value as AuthorizationState;
}
function boolean(value: unknown): boolean {
  if (typeof value !== 'boolean') throw new Error('BOOLEAN_REQUIRED');
  return value;
}
