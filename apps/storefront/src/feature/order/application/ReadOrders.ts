import type { StorefrontSession } from '../../../entity/session';
import type { EnterpriseMall } from '../../account';
import type { Order } from '../model/Order';
import type { OrderPort } from '../public/OrderPort';

export class ReadOrders {
  constructor(private readonly gateway: Pick<OrderPort, 'orders'>) {}
  async execute(session: StorefrontSession, mall: EnterpriseMall, signal?: AbortSignal): Promise<readonly Order[]> {
    return this.gateway.orders(session, mall, signal);
  }
}
