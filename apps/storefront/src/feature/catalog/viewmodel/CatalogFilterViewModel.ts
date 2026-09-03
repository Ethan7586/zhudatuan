import { useSearchParams } from 'react-router';

export interface CatalogFilters {
  readonly query: string;
  readonly category: string;
  readonly mealOnly: boolean;
  readonly subsidyOnly: boolean;
}

export function useCatalogFilters() {
  const [search, setSearch] = useSearchParams();
  const filters: CatalogFilters = Object.freeze({
    query: text(search.get('q'), 200),
    category: text(search.get('category'), 256) || 'all',
    mealOnly: search.get('account') === 'meal',
    subsidyOnly: search.get('exclusive') === 'true',
  });
  const update = (change: Partial<CatalogFilters>, replace = false) => {
    const next = new URLSearchParams(search);
    const value = { ...filters, ...change };
    assign(next, 'q', value.query, '');
    assign(next, 'category', value.category, 'all');
    assign(next, 'account', value.mealOnly ? 'meal' : '', '');
    assign(next, 'exclusive', value.subsidyOnly ? 'true' : '', '');
    setSearch(next, { replace });
  };
  return Object.freeze({ filters, update, reset: () => setSearch(new URLSearchParams(), { replace: false }) });
}

function assign(search: URLSearchParams, name: string, value: string, fallback: string): void {
  if (value === fallback) search.delete(name);
  else search.set(name, value);
}

function text(value: string | null, limit: number): string {
  return value?.trim().slice(0, limit) ?? '';
}
