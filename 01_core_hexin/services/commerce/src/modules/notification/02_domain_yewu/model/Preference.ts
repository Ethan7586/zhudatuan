import {
  DELIVERY_CHANNELS,
  type DeliveryChannelId,
} from './Template';

export type AuthorizationState = 'unknown' | 'accepted' | 'rejected';

export class Preference {
  constructor(readonly member: string, readonly channel: DeliveryChannelId, readonly event: string, readonly enabled: boolean,
    readonly authorization: AuthorizationState = 'unknown') {
    if (!member || !DELIVERY_CHANNELS.includes(channel) || !/^[a-z][a-z0-9.]{1,127}$/.test(event)
      || !['unknown', 'accepted', 'rejected'].includes(authorization)) throw new Error('NOTIFICATION_PREFERENCE_INVALID');
    if (channel === 'wechat' && enabled && authorization === 'rejected') throw new Error('NOTIFICATION_SUBSCRIPTION_REJECTED');
    Object.freeze(this);
  }
}
