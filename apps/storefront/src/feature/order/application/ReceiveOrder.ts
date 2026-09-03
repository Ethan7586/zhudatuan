import type { StorefrontSession } from '../../../entity/session';
import { OrderGateway } from '../infrastructure/OrderGateway';

export class ReceiveOrder {
  constructor(private readonly gateway: Pick<OrderGateway, 'receive'>) {}
  execute(session: StorefrontSession, orderId: string, expectedVersion: number) {
    return this.gateway.receive(session, orderId, expectedVersion, crypto.randomUUID());
  }
}
