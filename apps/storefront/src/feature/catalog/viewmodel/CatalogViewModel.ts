import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router';
import { useCartCommand } from '../../cart/public/index';
import { useCatalogState } from './CatalogState';
import { useCatalogFilters } from './CatalogFilterViewModel';

export function useCatalogViewModel() {
  const navigate = useNavigate();
  const filterState = useCatalogFilters();
  const [filterOpen, setFilterOpen] = useState(false);
  const [query, setQuery] = useState(filterState.filters.query);
  useEffect(() => {
    const timer = window.setTimeout(() => setQuery(filterState.filters.query), 250);
    return () => window.clearTimeout(timer);
  }, [filterState.filters.query]);
  const catalog = useCatalogState({
    ...(query ? { query } : {}),
    ...(filterState.filters.category !== 'all' ? { categoryId: filterState.filters.category } : {}),
    ...(filterState.filters.mealOnly ? { account: 'meal' as const } : {}),
    ...(filterState.filters.subsidyOnly ? { exclusive: true } : {}),
  });
  const cart = useCartCommand();
  return Object.freeze({
    presentationProducts: catalog.presentationProducts,
    presentationCategories: catalog.presentationCategories,
    addToCart: (product: Parameters<typeof cart.add>[0], quantity?: Parameters<typeof cart.add>[1]) => {
      void cart.add(product, quantity);
    },
    filters: filterState.filters,
    updateFilters: filterState.update,
    resetFilters: filterState.reset,
    hasMore: catalog.hasMore,
    isLoadingMore: catalog.isLoadingMore,
    loadMore: catalog.loadMore,
    filterOpen,
    actions: Object.freeze({
      toggleFilters: () => setFilterOpen((value) => !value),
      openProduct: (id: string) => void navigate(`/products/${encodeURIComponent(id)}`),
      home: () => void navigate('/'),
    }),
  });
}
