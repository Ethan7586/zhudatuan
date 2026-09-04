import type { StorefrontSession } from '../../../entity/session';
import type { OrderPort } from '../public/OrderPort';

export class ReceiveOrder {
  constructor(private readonly gateway: Pick<OrderPort, 'receive'>) {}
  execute(session: StorefrontSession, orderId: string, expectedVersion: number) {
    return this.gateway.receive(session, orderId, expectedVersion, crypto.randomUUID());
  }
}
