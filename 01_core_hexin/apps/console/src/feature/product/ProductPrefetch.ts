import type { QueryClient } from '@tanstack/react-query';
import type { ConsoleContext } from '../../entity/session/ConsoleSession';
import { productKey, readProducts, type ProductQuery } from './ProductQuery';

export const PRODUCT_PREFETCH_STALE_TIME_MS = 5 * 60_000;

export function prefetchProducts(queryClient: QueryClient, context: ConsoleContext): Promise<void> | undefined {
  if (!context.session.capabilities.includes('catalog.listings.read')) return undefined;
  const preview = context.scope.kind === 'platform' && context.scope.id === 'platform:preview';
  const filter: ProductQuery = { q: '', category: '', supplier: '', mall: '', status: '', limit: 50, preview };
  const queryKey = productKey(context, filter);
  if (queryClient.getQueryData(queryKey) !== undefined || queryClient.getQueryState(queryKey)?.fetchStatus === 'fetching') return undefined;
  return queryClient.prefetchQuery({
    queryKey,
    queryFn: ({ signal }) => readProducts(context, filter, signal),
    staleTime: PRODUCT_PREFETCH_STALE_TIME_MS,
    retry: false,
  });
}
