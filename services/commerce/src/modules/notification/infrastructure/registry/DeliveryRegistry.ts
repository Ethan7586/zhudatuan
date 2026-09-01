import { token } from '../../../../bootstrap/Container';
import type { DeliveryChannel } from '../../application/port/DeliveryChannel';
import type { DeliveryResolver } from '../../application/port/DeliveryResolver';

export class DeliveryRegistry implements DeliveryResolver {
  private readonly channels: ReadonlyMap<string, DeliveryChannel>;

  constructor(channels: readonly DeliveryChannel[]) {
    this.channels = new Map(channels.map((channel) => [channel.id, channel]));
    if (this.channels.size !== channels.length) throw new Error('DELIVERY_CHANNEL_DUPLICATE');
  }

  require(id: string): DeliveryChannel {
    const channel = this.channels.get(id);
    if (!channel) throw new Error(`DELIVERY_CHANNEL_UNAVAILABLE:${id}`);
    return channel;
  }
}

export const DELIVERY_REGISTRY = token<DeliveryRegistry>('notification.deliveries');
