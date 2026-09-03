import type { StorefrontSession } from '../../../entity/session';
import type { EnterpriseMall } from '../../account/model/Profile';
import type { Order } from '../model/Order';
import { OrderGateway } from '../infrastructure/OrderGateway';
import { mapOrder, mapTimeline } from '../infrastructure/OrderMapper';

export class ReadOrder {
  constructor(private readonly gateway: Pick<OrderGateway, 'order' | 'tracking'>) {}
  async execute(session: StorefrontSession, mall: EnterpriseMall, orderId: string, signal?: AbortSignal): Promise<Order | null> {
    const [orders, tracking] = await Promise.all([this.gateway.order(session, orderId, signal), this.gateway.tracking(session, orderId, signal)]);
    const order = orders.items[0];
    return order ? mapOrder(order, mall, mapTimeline(tracking)) : null;
  }
}
