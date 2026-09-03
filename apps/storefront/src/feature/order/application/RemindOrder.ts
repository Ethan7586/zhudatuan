import type { StorefrontSession } from '../../../entity/session';
import { OrderGateway } from '../infrastructure/OrderGateway';

export class RemindOrder {
  constructor(private readonly gateway: Pick<OrderGateway, 'remind'>) {}
  execute(session: StorefrontSession, orderId: string) {
    return this.gateway.remind(session, orderId, crypto.randomUUID());
  }
}
