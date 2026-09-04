import type { OrderOperations } from '@shop/sdk/order';
import type { RequestContextFactory } from '../../../shared/api/RequestContext';
import type { StorefrontSession } from '../../../entity/session';
import type { EnterpriseMall } from '../../account';
import type { Order } from '../model/Order';
import { mapOrderDetail, mapOrders } from './OrderMapper';
import type { OrderPort } from '../public/OrderPort';

export class OrderGateway implements OrderPort {
  constructor(
    private readonly orderClient: OrderOperations,
    private readonly context: RequestContextFactory
  ) {}
  async orders(session: StorefrontSession, mall: EnterpriseMall, signal?: AbortSignal): Promise<readonly Order[]> {
    return mapOrders(await this.orderClient.ordersRead({ query: { limit: 50 } }, this.context(session, { signal })), mall);
  }

  async order(session: StorefrontSession, mall: EnterpriseMall, orderId: string, signal?: AbortSignal): Promise<Order | null> {
    return mapOrderDetail(await this.orderClient.detailRead({ path: { orderid: orderId } }, this.context(session, { signal })), mall);
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
