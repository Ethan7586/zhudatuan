import type { OrderStatus } from './Order';

export type OrderFilter = 'all' | OrderStatus;

export const ORDER_FILTERS: readonly OrderFilter[] = Object.freeze(['all', 'pending_payment', 'pending_shipment', 'pending_receipt', 'completed', 'after_sale']);

export function orderFilter(value: string | null): OrderFilter {
  return value !== null && ORDER_FILTERS.some((filter) => filter === value) ? (value as OrderFilter) : 'all';
}
