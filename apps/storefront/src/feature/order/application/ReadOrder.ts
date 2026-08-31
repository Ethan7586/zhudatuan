import type { StorefrontSession } from '../../../shared/api/Session';
import type { MallView } from '../../../shared/runtime/StorefrontPort';
import type { Order } from '../model/Order';
import { OrderGateway } from '../infrastructure/OrderGateway';
import { mapOrder, mapTimeline } from '../infrastructure/OrderMapper';

export class ReadOrder {
  async execute(session: StorefrontSession, mall: MallView, orderId: string, signal?: AbortSignal): Promise<Order | null> {
    const [orders, tracking] = await Promise.all([OrderGateway.order(session, orderId, signal), OrderGateway.tracking(session, orderId, signal)]);
    const order = orders.items[0];
    return order ? mapOrder(order, mall, mapTimeline(tracking)) : null;
  }
}
