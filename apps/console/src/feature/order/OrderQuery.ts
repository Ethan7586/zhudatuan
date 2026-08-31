import { createFetchOrderOrdersRead } from '@shop/sdk/order';
import type { ConsoleContext } from '../../entity/session/ConsoleSession';
import { consoleRequest } from '../../shared/api/Client';
import { appConfig } from '../../shared/config/AppConfig';
import { OrderPageSchema, type OrderFilter } from './OrderSchema';

const ordersRead = createFetchOrderOrdersRead(appConfig.apiBaseUrl);
export const ORDER_PAGE_LIMIT = 50;

export interface OrderQuery extends OrderFilter {
  readonly cursor?: string;
}

export const orderKey = (context: ConsoleContext, filter: OrderQuery) =>
  Object.freeze(['console', context.scope.kind, context.scope.id, context.session.accessVersion, 'order.orders.read', filter.order, filter.cursor ?? null, ORDER_PAGE_LIMIT] as const);

export async function readOrders(context: ConsoleContext, filter: OrderQuery, signal: AbortSignal) {
  const value = await ordersRead(
    {
      query: {
        limit: ORDER_PAGE_LIMIT,
        ...(filter.order === '' ? {} : { order: filter.order }),
        ...(filter.cursor === undefined ? {} : { cursor: filter.cursor }),
      },
    },
    consoleRequest(context.scope, signal, context.session.accessVersion)
  );
  return OrderPageSchema.parse(value);
}
