import type { ConsoleContext } from '../../../entity/session/ConsoleSession';
import type { AfterSaleQuery } from '../model/AfterSale';
import { ORDER_PAGE_LIMIT, orderFilterKey, type OrderQuery } from '../model/OrderQuery';

export const orderKey = (context: ConsoleContext, filter: OrderQuery) =>
  Object.freeze(['console', context.scope.kind, context.scope.id, context.session.accessVersion, 'order.orders.read', ...orderFilterKey(filter), filter.view, filter.cursor ?? null, ORDER_PAGE_LIMIT] as const);

export const orderDetailKey = (context: ConsoleContext, reference: string) =>
  Object.freeze(['console', context.scope.kind, context.scope.id, context.session.accessVersion, 'order.orders.read', 'detail', reference] as const);

export const aftersaleKey = (context: ConsoleContext, filter: AfterSaleQuery) =>
  Object.freeze(['console', context.scope.kind, context.scope.id, context.session.accessVersion, 'order.aftersales.read', ...orderFilterKey(filter), filter.cursor ?? null, ORDER_PAGE_LIMIT] as const);
