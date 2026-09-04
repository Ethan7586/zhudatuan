import { EMPTY_ORDER_LIST_FILTER, OrderListFilterSchema, OrderReferenceSchema, OrderViewSchema, type OrderListFilter, type OrderView } from '../model/OrderFilter';
import { ORDER_FULFILLMENT_STATES, ORDER_LIFECYCLE_STATES, ORDER_LIST_VIEWS, ORDER_PAYMENT_STATES, ORDER_PLACED_FILTERS } from '@shop/contract/order';
import { defineQueryState, enumQuery, integerQuery, optionalQuery, stringQuery } from '../../../shared/query/QueryState';
import type { OrderDetailTab, OrderPageTab } from '../model/Order';

const detailTabs: readonly OrderDetailTab[] = Object.freeze(['overview', 'products', 'payment', 'aftersale', 'finance', 'support', 'operations']);
const pageTabs: readonly OrderPageTab[] = Object.freeze(['overview', 'products', 'payment', 'fulfillment', 'aftersale', 'finance', 'support', 'audit']);
const query = defineQueryState({
  search: stringQuery(), placed: enumQuery(['', ...ORDER_PLACED_FILTERS], ''), from: stringQuery(), to: stringQuery(),
  lifecycle: enumQuery(['', ...ORDER_LIFECYCLE_STATES], ''), payment: enumQuery(['', ...ORDER_PAYMENT_STATES], ''),
  fulfillment: enumQuery(['', ...ORDER_FULFILLMENT_STATES], ''), mall: stringQuery(), channel: stringQuery(), product: stringQuery(), member: stringQuery(),
  minimumMinor: stringQuery('', 12), maximumMinor: stringQuery('', 12), view: enumQuery([...ORDER_LIST_VIEWS, 'aftersale'], 'all'),
  selected: optionalQuery(255), tab: enumQuery(detailTabs, 'overview'), page: integerQuery(1), cursor: optionalQuery(), section: enumQuery(pageTabs, 'overview'),
});

export function readFilter(search: URLSearchParams): OrderListFilter {
  const value = query.read(search);
  const parsed = OrderListFilterSchema.safeParse({ search: value.search, placed: value.placed, from: value.from, to: value.to, lifecycle: value.lifecycle,
    payment: value.payment, fulfillment: value.fulfillment, mall: value.mall, channel: value.channel, product: value.product, member: value.member,
    minimumMinor: value.minimumMinor, maximumMinor: value.maximumMinor });
  return parsed.success ? parsed.data : EMPTY_ORDER_LIST_FILTER;
}

export function readView(search: URLSearchParams): OrderView {
  const parsed = OrderViewSchema.safeParse(query.read(search).view);
  return parsed.success ? parsed.data : 'all';
}

export function readSelected(search: URLSearchParams): string | undefined {
  const value = query.read(search).selected;
  if (value === undefined) return undefined;
  const parsed = OrderReferenceSchema.safeParse(value);
  return parsed.success ? parsed.data : undefined;
}

export function readDetailTab(search: URLSearchParams): OrderDetailTab {
  return query.read(search).tab;
}

export function readCursor(search: URLSearchParams): string | undefined {
  return query.read(search).cursor;
}

export function readPage(search: URLSearchParams): number {
  return query.read(search).page;
}

export function readPageTab(search: URLSearchParams): OrderPageTab {
  return query.read(search).section;
}

export function writeOrderFilter(search: URLSearchParams, value: OrderListFilter): URLSearchParams {
  return query.patch(search, { ...value, page: 1, cursor: undefined });
}

export function writeOrderView(search: URLSearchParams, view: OrderView): URLSearchParams {
  return query.patch(search, { view, page: 1, cursor: undefined });
}

export function writeOrderSelection(search: URLSearchParams, selected?: string, tab: OrderDetailTab = 'overview'): URLSearchParams {
  return query.patch(search, { selected, tab });
}

export function writeOrderTab(search: URLSearchParams, tab: OrderDetailTab): URLSearchParams {
  return query.patch(search, { tab });
}

export function writeOrderCursor(search: URLSearchParams, cursor: string | undefined, page: number): URLSearchParams {
  return query.patch(search, { page, cursor });
}

export function writePageTab(search: URLSearchParams, section: OrderPageTab): URLSearchParams {
  return query.patch(search, { section });
}
