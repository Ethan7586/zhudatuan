import type { StorefrontSession } from '../../../entity/session';
import type { EnterpriseMall } from '../../account';
import type { Order } from '../model/Order';
import type { OrderPort } from '../public/OrderPort';

export class ReadOrder {
  constructor(private readonly gateway: Pick<OrderPort, 'order'>) {}
  async execute(session: StorefrontSession, mall: EnterpriseMall, orderId: string, signal?: AbortSignal): Promise<Order | null> {
    return this.gateway.order(session, mall, orderId, signal);
  }
}
