import type { OperationInputFor, OperationOutputFor } from '@shop/contract';
import { DomainError } from '../../../../platform/error/DomainError';
import type { WriteHandlerContext } from '../../../../pipeline/HandlerContext';
import type { OperationHandler, OperationReply } from '../../../../pipeline/OperationHandler';
import { bodyRecord } from '../../../../pipeline/Validation';
import { requireSession } from '../../../../platform/security/OperationSecurityContext';
import { Preference, type AuthorizationState, type ConsentSource, type QuietHours } from '../../domain/model/Preference';
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
    const quiet = quietHours(body.quietHours);
    const expected = context.expectedVersion ?? 0;
    const row = await this.notifications.changePreference(context.transaction, member.member, member.organization, channel, event, enabled, quiet, expected);
    if (!row) throw new DomainError('VERSION_CONFLICT');
    new Preference(member.member, channel, event, enabled, authorizationState(row.authorization_state), consentSource(row.consent_source), quiet, Number(row.version));
    return { status: 200, body: row as OperationOutputFor<'notification.preferences.manage'> };
  }
}

function quietHours(value: unknown): QuietHours | null {
  if (value === undefined || value === null) return null;
  if (typeof value !== 'object' || Array.isArray(value)) throw new Error('NOTIFICATION_QUIET_HOURS_INVALID');
  const record = value as Readonly<Record<string, unknown>>;
  if (Object.keys(record).sort().join(',') !== 'end,start,timezone' || typeof record.start !== 'string' || typeof record.end !== 'string' || typeof record.timezone !== 'string') {
    throw new Error('NOTIFICATION_QUIET_HOURS_INVALID');
  }
  return Object.freeze({ start: record.start, end: record.end, timezone: record.timezone });
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
  if (!['unknown', 'accepted', 'rejected'].includes(String(value))) throw new Error('NOTIFICATION_AUTHORIZATION_INVALID');
  return value as AuthorizationState;
}
function consentSource(value: unknown): ConsentSource {
  if (!['member', 'provider', 'operator', 'system'].includes(String(value))) throw new Error('NOTIFICATION_CONSENT_SOURCE_INVALID');
  return value as ConsentSource;
}
function boolean(value: unknown): boolean {
  if (typeof value !== 'boolean') throw new Error('BOOLEAN_REQUIRED');
  return value;
}
