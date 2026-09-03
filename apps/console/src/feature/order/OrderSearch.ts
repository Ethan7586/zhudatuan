import { emptyOrderFilter } from './OrderFilter';
import { OrderDetailTabSchema, OrderFilterSchema, OrderListFilterSchema, type OrderDetailTab, type OrderListFilter, type OrderView } from './OrderSchema';

export function readFilter(search: URLSearchParams): OrderListFilter {
  const parsed = OrderListFilterSchema.safeParse({
    order: search.get('order') ?? '',
  });
  return parsed.success ? parsed.data : emptyOrderFilter;
}

export function readView(search: URLSearchParams): OrderView {
  return search.get('view') === 'aftersale' ? 'aftersale' : 'all';
}

export function readSelected(search: URLSearchParams): string | undefined {
  const value = search.get('selected');
  if (value === null) return undefined;
  const parsed = OrderFilterSchema.safeParse({ order: value });
  return parsed.success && parsed.data.order !== '' ? parsed.data.order : undefined;
}

export function readDetailTab(search: URLSearchParams): OrderDetailTab {
  const parsed = OrderDetailTabSchema.safeParse(search.get('tab') ?? 'overview');
  return parsed.success ? parsed.data : 'overview';
}
