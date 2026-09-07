import type { FrontendOrder } from '../../adapters/frontendData';

export type MobileOrderFilter = 'all' | 'pending_payment' | 'pending_shipment' | 'completed' | 'after_sale';

const MOBILE_ORDER_FILTERS = new Set<MobileOrderFilter>(['all', 'pending_payment', 'pending_shipment', 'completed', 'after_sale']);
let selectedMobileOrderFilter: MobileOrderFilter = 'all';

export function normalizeMobileOrderFilter(value: string | undefined): MobileOrderFilter {
  return value && MOBILE_ORDER_FILTERS.has(value as MobileOrderFilter) ? value as MobileOrderFilter : 'all';
}

export function selectMobileOrderFilter(filter: MobileOrderFilter): void {
  selectedMobileOrderFilter = filter;
}

export function currentMobileOrderFilter(): MobileOrderFilter {
  return selectedMobileOrderFilter;
}

export function matchesMobileOrderFilter(status: FrontendOrder['status'], filter: MobileOrderFilter): boolean {
  if (filter === 'all') return true;
  if (filter === 'pending_payment') return status === 'pending_payment' || status === 'pending_pay';
  if (filter === 'pending_shipment') {
    return status === 'pending_shipment'
      || status === 'pending_receipt'
      || status === 'paid'
      || status === 'shipping'
      || status === 'shipped';
  }
  return status === filter;
}
