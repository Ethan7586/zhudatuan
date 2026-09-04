import { createFetchOrderOrdersRead } from '@shop/sdk/order';
import type { ConsoleContext } from '../../entity/session/ConsoleSession';
import { consoleRequest } from '../../shared/api/Client';
import { appConfig } from '../../shared/config/AppConfig';
import { OrderPageSchema } from './OrderSchema';

const ordersRead = createFetchOrderOrdersRead(appConfig.apiBaseUrl);

export const orderDetailKey = (context: ConsoleContext, orderId: string) => Object.freeze(['console', context.scope.kind, context.scope.id, context.session.accessVersion, 'order.orders.read', 'detail', orderId] as const);
export async function readOrderDetail(context: ConsoleContext, orderId: string, signal: AbortSignal) {
  const page = OrderPageSchema.parse(await ordersRead({ query: { order: orderId, limit: 1 } }, consoleRequest(context.scope, signal, context.session.accessVersion)));
  return page.items.find((order) => order.id === orderId);
}
