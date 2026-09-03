import { EMPTY_ORDER_LIST_FILTER, OrderFilterSchema, OrderListFilterSchema, OrderViewSchema, type OrderListFilter, type OrderView } from '../model/OrderFilter';
import type { OrderDetailTab } from '../model/Order';

const detailTabs: readonly OrderDetailTab[] = Object.freeze(['overview', 'products', 'payment', 'aftersale', 'operations']);

export function readFilter(search: URLSearchParams): OrderListFilter {
  const parsed = OrderListFilterSchema.safeParse({
    order: search.get('order') ?? '',
    placed: search.get('placed') ?? '',
    lifecycle: search.get('lifecycle') ?? '',
    payment: search.get('payment') ?? '',
    fulfillment: search.get('fulfillment') ?? '',
    mall: search.get('mall') ?? '',
  });
  return parsed.success ? parsed.data : EMPTY_ORDER_LIST_FILTER;
}

export function readView(search: URLSearchParams): OrderView {
  const parsed = OrderViewSchema.safeParse(search.get('view') ?? 'all');
  return parsed.success ? parsed.data : 'all';
}

export function readSelected(search: URLSearchParams): string | undefined {
  const value = search.get('selected');
  if (value === null) return undefined;
  const parsed = OrderFilterSchema.safeParse({ order: value });
  return parsed.success && parsed.data.order !== '' ? parsed.data.order : undefined;
}

export function readDetailTab(search: URLSearchParams): OrderDetailTab {
  const value = search.get('tab') ?? 'overview';
  return detailTabs.includes(value as OrderDetailTab) ? value as OrderDetailTab : 'overview';
}
