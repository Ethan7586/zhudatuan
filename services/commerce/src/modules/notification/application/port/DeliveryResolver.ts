import type { DeliveryChannel } from './DeliveryChannel';

export interface DeliveryResolver {
  require(id: string): DeliveryChannel;
}
