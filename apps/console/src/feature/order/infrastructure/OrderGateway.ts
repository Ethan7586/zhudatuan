import { createFetchOrderAftersalesRead, createFetchOrderOrdersRead } from '@shop/sdk/order';
import type { ConsoleContext } from '../../../entity/session/ConsoleSession';
import { consoleRequest } from '../../../shared/api/Client';
import type { AfterSaleQuery } from '../model/AfterSale';
import { ORDER_PAGE_LIMIT, type OrderQuery } from '../model/OrderQuery';
import type { OrderPort } from '../public';
import { OrderMapper } from './OrderMapper';

export class OrderGateway implements OrderPort {
  private readonly ordersRead;
  private readonly aftersalesRead;
  private readonly mapper = new OrderMapper();

  constructor(baseUrl: string) {
    this.ordersRead = createFetchOrderOrdersRead(baseUrl);
    this.aftersalesRead = createFetchOrderAftersalesRead(baseUrl);
  }

  async orders(context: ConsoleContext, filter: OrderQuery, signal?: AbortSignal) {
    const value = await this.ordersRead(
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
    return this.mapper.page(value);
  }

  async order(context: ConsoleContext, reference: string, signal?: AbortSignal) {
    return this.mapper.order(await this.ordersRead({ query: { order: reference, limit: 1 } }, consoleRequest(context.scope, signal, context.session.accessVersion)));
  }

  async aftersales(context: ConsoleContext, filter: AfterSaleQuery, signal?: AbortSignal) {
    const value = await this.aftersalesRead(
      { query: { limit: ORDER_PAGE_LIMIT, ...orderFilterQuery(filter), ...(filter.cursor === undefined ? {} : { cursor: filter.cursor }) } },
      consoleRequest(context.scope, signal, context.session.accessVersion)
    );
    return this.mapper.aftersales(value);
  }
}

function orderFilterQuery(filter: Readonly<{ order: string; placed: string; lifecycle: string; payment: string; fulfillment: string; mall: string }>) {
  return {
    ...(filter.order === '' ? {} : { order: filter.order }),
    ...(filter.placed === '' ? {} : { placed: filter.placed as never }),
    ...(filter.lifecycle === '' ? {} : { lifecycle: filter.lifecycle as never }),
    ...(filter.payment === '' ? {} : { payment: filter.payment as never }),
    ...(filter.fulfillment === '' ? {} : { fulfillment: filter.fulfillment as never }),
    ...(filter.mall === '' ? {} : { mall: filter.mall }),
  } as const;
}
