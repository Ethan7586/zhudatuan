import type { OrderOperations } from '@shop/sdk/order';
import type { FulfillmentOperations } from '@shop/sdk/fulfillment';
import type { RequestContextFactory } from '../../../shared/api/RequestContext';
import type { StorefrontSession } from '../../../entity/session';
import type { EnterpriseMall } from '../../account';
import type { Order } from '../model/Order';
import { mapOrderDetail, mapOrders } from './OrderMapper';
import type { OrderPort } from '../public/OrderPort';
import { readCursorPages } from '../../../shared/api/CursorPage';

export class OrderGateway implements OrderPort {
  constructor(
    private readonly orderClient: OrderOperations,
    private readonly fulfillmentClient: FulfillmentOperations,
    private readonly context: RequestContextFactory
  ) {}
  async orders(session: StorefrontSession, mall: EnterpriseMall, signal?: AbortSignal): Promise<readonly Order[]> {
    const pages = await readCursorPages(
      (cursor) => this.orderClient.ordersRead({ query: { limit: 50, ...(cursor ? { cursor } : {}) } }, this.context(session, { signal })),
      signal
    );
    return Object.freeze(pages.flatMap((page) => mapOrders(page, mall)));
  }

  async order(session: StorefrontSession, mall: EnterpriseMall, orderId: string, signal?: AbortSignal): Promise<Order | null> {
    const context = this.context(session, { signal });
    const [detail, tracking] = await Promise.allSettled([
      this.orderClient.detailRead({ path: { orderid: orderId } }, context),
      this.fulfillmentClient.trackingRead({ query: { order: orderId } }, context),
    ]);
    if (detail.status === 'rejected') throw detail.reason;
    return mapOrderDetail(detail.value, mall, tracking.status === 'fulfilled' ? tracking.value : null);
  }

  async receive(session: StorefrontSession, orderId: string, expectedVersion: number, idempotencyKey: string): Promise<void> {
    await this.orderClient.ordersReceive({ path: { orderid: orderId }, body: { expectedVersion } }, this.context(session, { write: true, expectedVersion, idempotencyKey }));
  }

  async cancel(session: StorefrontSession, orderId: string, expectedVersion: number, reason: string, idempotencyKey: string): Promise<void> {
    await this.orderClient.ordersCancel({ path: { orderid: orderId }, body: { expectedVersion, reason } }, this.context(session, { write: true, expectedVersion, idempotencyKey }));
  }

  async remind(session: StorefrontSession, orderId: string, idempotencyKey: string): Promise<void> {
    await this.orderClient.remindersCreate({ path: { orderid: orderId }, body: {} }, this.context(session, { write: true, idempotencyKey }));
  }
}
