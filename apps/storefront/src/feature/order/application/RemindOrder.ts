import type { StorefrontSession } from '../../../entity/session';
import type { OrderPort } from '../public/OrderPort';

export class RemindOrder {
  constructor(private readonly gateway: Pick<OrderPort, 'remind'>) {}
  execute(session: StorefrontSession, orderId: string) {
    return this.gateway.remind(session, orderId, crypto.randomUUID());
  }
}
