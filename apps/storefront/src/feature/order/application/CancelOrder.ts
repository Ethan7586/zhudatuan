import type { StorefrontSession } from '../../../entity/session';
import type { OrderPort } from '../public/OrderPort';

export class CancelOrder {
  constructor(private readonly gateway: Pick<OrderPort, 'cancel'>) {}

  execute(session: StorefrontSession, orderId: string, expectedVersion: number, reason: string) {
    return this.gateway.cancel(session, orderId, expectedVersion, reason, crypto.randomUUID());
  }
}
