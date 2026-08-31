import { useSearchParams } from 'react-router';

export type CatalogSort = 'default' | 'sales' | 'priceasc' | 'pricedesc';

export interface CatalogFilters {
  readonly query: string;
  readonly category: string;
  readonly mealOnly: boolean;
  readonly subsidyOnly: boolean;
  readonly sort: CatalogSort;
  readonly minimum: number;
  readonly maximum: number;
}

export function useCatalogFilters() {
  const [search, setSearch] = useSearchParams();
  const filters: CatalogFilters = Object.freeze({
    query: text(search.get('q'), 200),
    category: text(search.get('category'), 256) || 'all',
    mealOnly: search.get('account') === 'meal',
    subsidyOnly: search.get('exclusive') === 'true',
    sort: sort(search.get('sort')),
    minimum: amount(search.get('min'), 0),
    maximum: amount(search.get('max'), 5000),
  });
  const update = (change: Partial<CatalogFilters>, replace = false) => {
    const next = new URLSearchParams(search);
    const value = { ...filters, ...change };
    assign(next, 'q', value.query, '');
    assign(next, 'category', value.category, 'all');
    assign(next, 'account', value.mealOnly ? 'meal' : '', '');
    assign(next, 'exclusive', value.subsidyOnly ? 'true' : '', '');
    assign(next, 'sort', value.sort, 'default');
    assign(next, 'min', String(value.minimum), '0');
    assign(next, 'max', String(value.maximum), '5000');
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

function amount(value: string | null, fallback: number): number {
  const parsed = Number(value ?? fallback);
  return Number.isFinite(parsed) && parsed >= 0 && parsed <= 10_000_000 ? parsed : fallback;
}

function sort(value: string | null): CatalogSort {
  return value === 'sales' || value === 'priceasc' || value === 'pricedesc' ? value : 'default';
}
