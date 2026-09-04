import type { OrderListFilter, OrderView } from './OrderFilter';

export const ORDER_PAGE_LIMIT = 50;

export interface OrderQuery extends OrderListFilter {
  readonly view: Exclude<OrderView, 'aftersale'>;
  readonly cursor?: string;
}

export function orderFilterKey(filter: OrderListFilter): readonly string[] {
  return Object.freeze([
    filter.search,
    filter.placed,
    filter.from,
    filter.to,
    filter.lifecycle,
    filter.payment,
    filter.fulfillment,
    filter.mall,
    filter.channel,
    filter.product,
    filter.member,
    filter.minimumMinor,
    filter.maximumMinor,
  ]);
}
