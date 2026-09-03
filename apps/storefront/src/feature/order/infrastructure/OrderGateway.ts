import type { OperationOutputFor } from '@shop/contract';
import type { StorefrontClient } from '../../../shared/api/Client';
import type { StorefrontSession } from '../../../entity/session';

export class OrderGateway {
  constructor(
    private readonly orderClient: StorefrontClient['commerce']['order'],
    private readonly fulfillment: StorefrontClient['commerce']['fulfillment'],
    private readonly context: StorefrontClient['context']
  ) {}
  orders(session: StorefrontSession, signal?: AbortSignal): Promise<OperationOutputFor<'order.orders.read'>> {
    return this.orderClient.ordersRead({ query: { limit: 50 } }, this.context(session, { signal }));
  }

  order(session: StorefrontSession, orderId: string, signal?: AbortSignal): Promise<OperationOutputFor<'order.orders.read'>> {
    return this.orderClient.ordersRead({ query: { order: orderId, limit: 1 } }, this.context(session, { signal }));
  }

  tracking(session: StorefrontSession, orderId: string, signal?: AbortSignal): Promise<OperationOutputFor<'fulfillment.tracking.read'>> {
    return this.fulfillment.trackingRead({ query: { order: orderId } }, this.context(session, { signal }));
  }

  receive(session: StorefrontSession, orderId: string, expectedVersion: number, idempotencyKey: string): Promise<OperationOutputFor<'order.orders.receive'>> {
    return this.orderClient.ordersReceive({ path: { orderid: orderId }, body: { expectedVersion } }, this.context(session, { write: true, expectedVersion, idempotencyKey }));
  }

  remind(session: StorefrontSession, orderId: string, idempotencyKey: string): Promise<OperationOutputFor<'order.reminders.create'>> {
    return this.orderClient.remindersCreate({ path: { orderid: orderId }, body: {} }, this.context(session, { write: true, idempotencyKey }));
  }
}
