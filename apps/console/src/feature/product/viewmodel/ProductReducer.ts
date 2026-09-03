import type { ProductColumnKey } from '../view/ProductTable';
import { resourceState, type ResourceInput, type ResourceState } from '@shop/presentation';
import type { ListingPage } from '../model/Product';

export const PRODUCT_COLUMNS: readonly ProductColumnKey[] = Object.freeze(['category', 'sku', 'status', 'updated']);
export const PRODUCT_PAGE_SIZES = new Set([20, 50, 100]);

export function pageNumber(value: string | null): number {
  const parsed = Number(value ?? 1);
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : 1;
}

export function pageLimit(value: string | null): number {
  const parsed = Number(value ?? 50);
  return PRODUCT_PAGE_SIZES.has(parsed) ? parsed : 50;
}

export function productState(input: ResourceInput<ListingPage>): ResourceState<ListingPage> {
  return resourceState(input);
}

export function productCondition(state: ResourceState<ListingPage>): 'loading' | 'ready' | 'empty' | 'refreshing' | 'stale' | 'denied' | 'failure' {
  if (state.kind === 'ready') return state.refreshing ? 'refreshing' : 'ready';
  if (state.kind === 'failed') return 'failure';
  return state.kind;
}
