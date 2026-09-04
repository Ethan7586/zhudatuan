import type { FulfillmentOperations } from '@shop/sdk/fulfillment';
import type { OrderOperations } from '@shop/sdk/order';
import type { RequestContextFactory } from '../../../shared/api/RequestContext';
import type { StorefrontSession } from '../../../entity/session';
import type { EnterpriseMall } from '../../account';
import type { Order } from '../model/Order';
import { mapOrder, mapOrders, mapTimeline } from './OrderMapper';
import type { OrderPort } from '../public/OrderPort';

export class OrderGateway implements OrderPort {
  constructor(
    private readonly orderClient: OrderOperations,
    private readonly fulfillment: FulfillmentOperations,
    private readonly context: RequestContextFactory
  ) {}
  async orders(session: StorefrontSession, mall: EnterpriseMall, signal?: AbortSignal): Promise<readonly Order[]> {
    return mapOrders(await this.orderClient.ordersRead({ query: { limit: 50 } }, this.context(session, { signal })), mall);
  }

  async order(session: StorefrontSession, mall: EnterpriseMall, orderId: string, signal?: AbortSignal): Promise<Order | null> {
    const [orders, tracking] = await Promise.all([
      this.orderClient.ordersRead({ query: { order: orderId, limit: 1 } }, this.context(session, { signal })),
      this.fulfillment.trackingRead({ query: { order: orderId } }, this.context(session, { signal })),
    ]);
    const order = orders.items[0];
    return order ? mapOrder(order, mall, mapTimeline(tracking)) : null;
  }

  async receive(session: StorefrontSession, orderId: string, expectedVersion: number, idempotencyKey: string): Promise<void> {
    await this.orderClient.ordersReceive({ path: { orderid: orderId }, body: { expectedVersion } }, this.context(session, { write: true, expectedVersion, idempotencyKey }));
  }

  async remind(session: StorefrontSession, orderId: string, idempotencyKey: string): Promise<void> {
    await this.orderClient.remindersCreate({ path: { orderid: orderId }, body: {} }, this.context(session, { write: true, idempotencyKey }));
  }
}
