import { DELIVERY_CHANNELS, type DeliveryChannelId } from './Template';
import type { ConsentSource } from './Preference';

export class Endpoint {
  constructor(
    readonly member: string,
    readonly channel: Exclude<DeliveryChannelId, 'inapp'>,
    readonly addressToken: string,
    readonly consentSource: ConsentSource,
    readonly consentAt: string,
    readonly revokedAt: string | null,
    readonly version: number
  ) {
    if (
      !member ||
      !DELIVERY_CHANNELS.includes(channel) ||
      !/^[a-f0-9]{64}$/.test(addressToken) ||
      !['member', 'provider', 'operator', 'system'].includes(consentSource) ||
      Number.isNaN(Date.parse(consentAt)) ||
      (revokedAt !== null && Number.isNaN(Date.parse(revokedAt))) ||
      !Number.isSafeInteger(version) ||
      version < 1
    ) throw new Error('NOTIFICATION_ENDPOINT_INVALID');
    Object.freeze(this);
  }

  active(): boolean {
    return this.revokedAt === null;
  }
}
