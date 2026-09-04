import type { OperationActions } from '../../../../foundation/application/ModuleOperations';
import { operationLifecycle, requireAccess, rowResult } from '../../../../foundation/application/ModuleOperations';
import type { KmsClient } from '../../../../foundation/infrastructure/KmsClient';
import type { DatabasePool } from '../../../../foundation/persistence/Pool';
import { bodyRecord, textField } from '../../../../foundation/interface/Validation';
import type { DeliveryChannelId } from '../../02_domain_yewu/model/Template';
import { DELIVERY_CHANNELS } from '../../02_domain_yewu/model/Template';
import { Preference, type AuthorizationState } from '../../02_domain_yewu/model/Preference';
import type { NotificationRepositoryFactory } from '../../01_public_gongkai/NotificationRepository';

export type { NotificationRepositoryFactory } from '../../01_public_gongkai/NotificationRepository';

export function changePreferenceOperations(kms: KmsClient, pool: DatabasePool, repositories: NotificationRepositoryFactory): OperationActions {
  return {
    'notification.preferences.manage': async (request, database) => {
      const access = requireAccess(request); const body = bodyRecord(request); const repository = repositories(database);
      const context = await repository.member(access.membership.id); const channel = channelId(request.input.path.channel);
      const event = eventType(request.input.path.eventtype); const enabled = boolean(body.enabled);
      const authorization = channel === 'wechat' ? authorizationState(body.authorization) : 'unknown';
      new Preference(context.member, channel, event, enabled, authorization);
      return rowResult(await repository.changePreference(context.member, context.organization, channel, event, enabled, authorization));
    },
    'notification.endpoints.manage': operationLifecycle({
      prepare: async (request) => {
        const access = requireAccess(request); const body = bodyRecord(request); const repository = repositories(pool);
        const context = { member: access.scope.id }; const channel = endpointChannel(request.input.path.channel);
        const enabled = boolean(body.enabled);
        if (!enabled) return { access, context, channel, envelope: null };
        let address: string;
        if (channel === 'wechat') {
          if (body.authorization !== 'accepted') throw new Error('NOTIFICATION_SUBSCRIPTION_AUTHORIZATION_REQUIRED');
          const identity = await repository.wechatIdentity(access.membership.id); const selected = identity.rows[0];
          if (!selected) throw new Error('WECHAT_IDENTITY_NOT_BOUND');
          address = await kms.decrypt('identity/wechat', selected.subject_ciphertext, { identity: selected.id });
        } else address = textField(body, 'address', 512);
        return { access, context, channel, envelope: await kms.encrypt('notification/recipient', address,
          { member: context.member, channel }) };
      },
      execute: async (_request, database, prepared) => {
        const repository = repositories(database); const current = await repository.member(prepared.access.membership.id);
        if (current.member !== prepared.context.member) throw new Error('MEMBERSHIP_OWNER_CHANGED');
        if (!prepared.envelope) {
          const revoked = await repository.revokeEndpoint(current.member, prepared.channel);
          return revoked.rows[0] ? rowResult(revoked) : { status: 204 };
        }
        return rowResult(await repository.saveEndpoint(current.member, prepared.channel, prepared.envelope));
      },
    }),
  };
}

function channelId(value: unknown): DeliveryChannelId {
  if (typeof value !== 'string' || !DELIVERY_CHANNELS.includes(value as DeliveryChannelId)) throw new Error('NOTIFICATION_CHANNEL_INVALID');
  return value as DeliveryChannelId;
}
function endpointChannel(value: unknown): Exclude<DeliveryChannelId, 'inapp'> {
  const channel = channelId(value); if (channel === 'inapp') throw new Error('NOTIFICATION_ENDPOINT_CHANNEL_INVALID'); return channel;
}
function eventType(value: unknown): string {
  if (typeof value !== 'string' || !/^[a-z][a-z0-9.]{1,127}$/.test(value)) throw new Error('NOTIFICATION_EVENT_INVALID'); return value;
}
function authorizationState(value: unknown): AuthorizationState {
  if (!['accepted', 'rejected'].includes(String(value))) throw new Error('NOTIFICATION_AUTHORIZATION_INVALID'); return value as AuthorizationState;
}
function boolean(value: unknown): boolean { if (typeof value !== 'boolean') throw new Error('BOOLEAN_REQUIRED'); return value; }
