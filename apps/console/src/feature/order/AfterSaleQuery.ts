import { createFetchOrderAftersalesRead } from '@shop/sdk/order';
import type { ConsoleContext } from '../../entity/session/ConsoleSession';
import { consoleRequest } from '../../shared/api/Client';
import { appConfig } from '../../shared/config/AppConfig';
import { AfterSalePageSchema } from './AfterSaleSchema';
import { ORDER_PAGE_LIMIT, orderFilterKey, orderFilterQuery } from './OrderQuery';
import type { OrderListFilter } from './OrderFilters';

const aftersalesRead = createFetchOrderAftersalesRead(appConfig.apiBaseUrl);

export interface AfterSaleQuery extends OrderListFilter {
  readonly cursor?: string;
}

export const aftersaleKey = (context: ConsoleContext, filter: AfterSaleQuery) =>
  Object.freeze(['console', context.scope.kind, context.scope.id, context.session.accessVersion, 'order.aftersales.read', ...orderFilterKey(filter), filter.cursor ?? null, ORDER_PAGE_LIMIT] as const);

export async function readAftersales(context: ConsoleContext, filter: AfterSaleQuery, signal: AbortSignal) {
  const value = await aftersalesRead(
    {
      query: {
        limit: ORDER_PAGE_LIMIT,
        ...orderFilterQuery(filter),
        ...(filter.cursor === undefined ? {} : { cursor: filter.cursor }),
      },
    },
    consoleRequest(context.scope, signal, context.session.accessVersion)
  );
  return AfterSalePageSchema.parse(value);
}
