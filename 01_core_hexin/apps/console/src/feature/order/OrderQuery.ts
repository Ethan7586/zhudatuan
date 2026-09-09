import { createFetchOrderOrdersRead } from '@shop/sdk/order';
import type { ConsoleContext } from '../../entity/session/ConsoleSession';
import { consoleRequest } from '../../shared/api/Client';
import { appConfig } from '../../shared/config/AppConfig';
import { OrderPageSchema, type OrderFilter, type OrderListFilter, type OrderView } from './OrderSchema';

const ordersRead = createFetchOrderOrdersRead(appConfig.apiBaseUrl);
export const ORDER_PAGE_LIMIT = 50;

export interface OrderQuery extends OrderFilter, Partial<Omit<OrderListFilter, 'order'>> {
  readonly cursor?: string;
  readonly view?: OrderView;
}

export const isOrderPreviewContext = (context: ConsoleContext): boolean => context.scope.kind === 'platform' && context.scope.id === 'platform:preview';

export const orderKey = (context: ConsoleContext, filter: OrderQuery) =>
  Object.freeze([
    'console',
    context.scope.kind,
    context.scope.id,
    context.session.accessVersion,
    'order.orders.read',
    filter.order,
    filter.placed ?? '',
    filter.lifecycle ?? '',
    filter.payment ?? '',
    filter.fulfillment ?? '',
    filter.mall ?? '',
    filter.view ?? 'all',
    filter.cursor ?? null,
    ORDER_PAGE_LIMIT,
  ] as const);

export async function readOrders(context: ConsoleContext, filter: OrderQuery, signal: AbortSignal) {
  const value = await ordersRead(
    {
      query: {
        limit: ORDER_PAGE_LIMIT,
        ...(filter.order === '' ? {} : { order: filter.order }),
        ...(filter.cursor === undefined ? {} : { cursor: filter.cursor }),
        ...(filter.placed ? { placed: filter.placed } : {}),
        ...(filter.lifecycle ? { lifecycle: filter.lifecycle } : {}),
        ...(filter.payment ? { payment: filter.payment } : {}),
        ...(filter.fulfillment ? { fulfillment: filter.fulfillment } : {}),
        ...(filter.mall ? { mall: filter.mall } : {}),
        ...(filter.view !== undefined && filter.view !== 'all' ? { view: filter.view } : {}),
      },
    },
    consoleRequest(context.scope, signal, context.session.accessVersion)
  );
  return OrderPageSchema.parse(value);
}
