import type { QueryClient } from '@tanstack/react-query';
import type { ConsoleContext } from '../../entity/session/ConsoleSession';
import { productKey, readProducts, type ProductQuery } from '../product/ProductQuery';

export const SUPPLY_CHAIN_PREFETCH_STALE_TIME_MS = 5 * 60_000;

export const supplyChainQuery: ProductQuery = Object.freeze({
  q: '', category: '', status: '', limit: 1, preview: true, view: 'supply-network',
});

export function prefetchSupplyChain(queryClient: QueryClient, context: ConsoleContext): Promise<void> | undefined {
  if (!context.session.capabilities.includes('catalog.listings.read')) return undefined;
  const queryKey = productKey(context, supplyChainQuery);
  if (queryClient.getQueryData(queryKey) !== undefined || queryClient.getQueryState(queryKey)?.fetchStatus === 'fetching') return undefined;
  return queryClient.prefetchQuery({
    queryKey,
    queryFn: ({ signal }) => readProducts(context, supplyChainQuery, signal),
    staleTime: SUPPLY_CHAIN_PREFETCH_STALE_TIME_MS,
    retry: false,
  });
}
