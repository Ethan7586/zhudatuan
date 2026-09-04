import { OP_ORDER_AFTERSALES_READ, OP_ORDER_DETAIL_READ, OP_ORDER_ORDERS_READ, OP_PAYMENT_RECOVERIES_READ, OP_SUPPORT_CASES_READ } from '@shop/contract/ids';
import type { ConsoleContext } from '../../../entity/session/ConsoleSession';
import type { AfterSaleQuery } from '../model/AfterSale';
import { ORDER_PAGE_LIMIT, orderFilterKey, type OrderQuery } from '../model/OrderQuery';

export const orderKey = (context: ConsoleContext, filter: OrderQuery) =>
  Object.freeze(['console', context.scope.kind, context.scope.id, context.session.accessVersion, OP_ORDER_ORDERS_READ, ...orderFilterKey(filter), filter.view, filter.cursor ?? null, ORDER_PAGE_LIMIT] as const);

export const orderDetailKey = (context: ConsoleContext, reference: string) => Object.freeze(['console', context.scope.kind, context.scope.id, context.session.accessVersion, OP_ORDER_DETAIL_READ, reference] as const);

export const orderSupportKey = (context: ConsoleContext, reference: string) => Object.freeze(['console', context.scope.kind, context.scope.id, context.session.accessVersion, OP_SUPPORT_CASES_READ, reference] as const);

export const orderRecoveryKey = (context: ConsoleContext, reference: string) => Object.freeze(['console', context.scope.kind, context.scope.id, context.session.accessVersion, OP_PAYMENT_RECOVERIES_READ, reference] as const);

export const aftersaleKey = (context: ConsoleContext, filter: AfterSaleQuery) =>
  Object.freeze(['console', context.scope.kind, context.scope.id, context.session.accessVersion, OP_ORDER_AFTERSALES_READ, ...orderFilterKey(filter), filter.cursor ?? null, ORDER_PAGE_LIMIT] as const);
