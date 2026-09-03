import { createFetchOrderOrdersRead } from '@shop/sdk/order';
import type { ConsoleContext } from '../../entity/session/ConsoleSession';
import { consoleRequest } from '../../shared/api/Client';
import { appConfig } from '../../shared/config/AppConfig';
import { type OrderListFilter, type OrderView } from './OrderFilters';
import { OrderPageSchema } from './OrderSchema';

const ordersRead = createFetchOrderOrdersRead(appConfig.apiBaseUrl);
export const ORDER_PAGE_LIMIT = 50;

export interface OrderQuery extends OrderListFilter {
  readonly view: Exclude<OrderView, 'aftersale'>;
  readonly cursor?: string;
}

export const orderKey = (context: ConsoleContext, filter: OrderQuery) =>
  Object.freeze(['console', context.scope.kind, context.scope.id, context.session.accessVersion, 'order.orders.read', ...orderFilterKey(filter), filter.view, filter.cursor ?? null, ORDER_PAGE_LIMIT] as const);

export async function readOrders(context: ConsoleContext, filter: OrderQuery, signal: AbortSignal) {
  const value = await ordersRead(
    {
      query: {
        limit: ORDER_PAGE_LIMIT,
        ...orderFilterQuery(filter),
        ...(filter.view === 'all' ? {} : { view: filter.view }),
        ...(filter.cursor === undefined ? {} : { cursor: filter.cursor }),
      },
    },
    consoleRequest(context.scope, signal, context.session.accessVersion)
  );
  return OrderPageSchema.parse(value);
}

export function orderFilterKey(filter: OrderListFilter): readonly string[] {
  return Object.freeze([filter.order, filter.placed, filter.lifecycle, filter.payment, filter.fulfillment, filter.mall]);
}

export function orderFilterQuery(filter: OrderListFilter) {
  return {
    ...(filter.order === '' ? {} : { order: filter.order }),
    ...(filter.placed === '' ? {} : { placed: filter.placed }),
    ...(filter.lifecycle === '' ? {} : { lifecycle: filter.lifecycle }),
    ...(filter.payment === '' ? {} : { payment: filter.payment }),
    ...(filter.fulfillment === '' ? {} : { fulfillment: filter.fulfillment }),
    ...(filter.mall === '' ? {} : { mall: filter.mall }),
  } as const;
}
