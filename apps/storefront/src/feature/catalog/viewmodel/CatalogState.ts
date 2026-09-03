import { useInfiniteQuery } from '@tanstack/react-query';
import { useRef } from 'react';
import { useSession } from '../../../entity/session/viewmodel/SessionContext';
import { StorefrontQuery } from '../../../shared/api/Query';
import type { CatalogFilter } from '../model/CatalogFilter';
import { ReadCatalog } from '../application/ReadCatalog';
import { toFrontendCategories, toFrontendProducts } from '../infrastructure/CatalogMapper';
import { useDependencies } from '../../../app/DependencyContext';

export function useCatalogState(filter: CatalogFilter = {}, enabled = true) {
  const session = useSession();
  const dependencies = useDependencies();
  const reader = useRef(new ReadCatalog(dependencies.catalog));
  const query = useInfiniteQuery({
    queryKey: StorefrontQuery.catalog(session.scope || 'guest', { ...filter }),
    queryFn: ({ signal, pageParam }) => reader.current.execute({ ...filter, ...(pageParam ? { cursor: pageParam } : {}) }, signal),
    initialPageParam: filter.cursor,
    getNextPageParam: (page) => page.nextCursor ?? undefined,
    enabled: Boolean(session.scope) && enabled,
  });
  const products = Object.freeze((query.data?.pages ?? []).flatMap(({ items }) => items.map(({ product }) => product)));
  return Object.freeze({
    products,
    presentationProducts: toFrontendProducts(products),
    presentationCategories: toFrontendCategories(products),
    state: query.isPending ? ('loading' as const) : query.isError ? ('error' as const) : ('ready' as const),
    hasMore: query.hasNextPage,
    isLoadingMore: query.isFetchingNextPage,
    loadMore: () => query.fetchNextPage(),
  });
}
