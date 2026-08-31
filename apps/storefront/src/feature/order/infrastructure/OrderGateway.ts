import type { OperationOutputFor } from '@shop/contract';
import { storefrontClient } from '../../../shared/api/Client';
import type { StorefrontSession } from '../../../shared/api/Session';

export const OrderGateway = Object.freeze({
  orders(session: StorefrontSession, signal?: AbortSignal): Promise<OperationOutputFor<'order.orders.read'>> {
    return storefrontClient.commerce.order.ordersRead({ query: { limit: 50 } }, storefrontClient.context(session, { signal }));
  },

  order(session: StorefrontSession, orderId: string, signal?: AbortSignal): Promise<OperationOutputFor<'order.orders.read'>> {
    return storefrontClient.commerce.order.ordersRead({ query: { order: orderId, limit: 1 } }, storefrontClient.context(session, { signal }));
  },

  tracking(session: StorefrontSession, orderId: string, signal?: AbortSignal): Promise<OperationOutputFor<'fulfillment.tracking.read'>> {
    return storefrontClient.commerce.fulfillment.trackingRead({ query: { order: orderId } }, storefrontClient.context(session, { signal }));
  },

  receive(session: StorefrontSession, orderId: string, expectedVersion: number, idempotencyKey: string): Promise<OperationOutputFor<'order.orders.receive'>> {
    return storefrontClient.commerce.order.ordersReceive({ path: { orderid: orderId }, body: { expectedVersion } }, storefrontClient.context(session, { write: true, expectedVersion, idempotencyKey }));
  },

  remind(session: StorefrontSession, orderId: string, idempotencyKey: string): Promise<OperationOutputFor<'order.reminders.create'>> {
    return storefrontClient.commerce.order.remindersCreate({ path: { orderid: orderId }, body: {} }, storefrontClient.context(session, { write: true, idempotencyKey }));
  },
});
