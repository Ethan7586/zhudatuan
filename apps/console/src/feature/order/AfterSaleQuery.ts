import { createFetchOrderAftersalesRead } from '@shop/sdk/order';
import type { ConsoleContext } from '../../entity/session/ConsoleSession';
import { consoleRequest } from '../../shared/api/Client';
import { appConfig } from '../../shared/config/AppConfig';
import { AfterSalePageSchema } from './AfterSaleSchema';
import { ORDER_PAGE_LIMIT } from './OrderQuery';

const aftersalesRead = createFetchOrderAftersalesRead(appConfig.apiBaseUrl);

export interface AfterSaleQuery {
  readonly order: string;
  readonly cursor?: string;
}

export const aftersaleKey = (context: ConsoleContext, filter: AfterSaleQuery) =>
  Object.freeze(['console', context.scope.kind, context.scope.id, context.session.accessVersion, 'order.aftersales.read', filter.order, filter.cursor ?? null, ORDER_PAGE_LIMIT] as const);

export async function readAftersales(context: ConsoleContext, filter: AfterSaleQuery, signal: AbortSignal) {
  const value = await aftersalesRead(
    {
      query: {
        limit: ORDER_PAGE_LIMIT,
        ...(filter.order === '' ? {} : { order: filter.order }),
        ...(filter.cursor === undefined ? {} : { cursor: filter.cursor }),
      },
    },
    consoleRequest(context.scope, signal, context.session.accessVersion)
  );
  return AfterSalePageSchema.parse(value);
}
