import { queryCondition, safeQueryError } from '@shop/presentation';
import { useQuery } from '@tanstack/react-query';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router';
import type { FinanceDependencies } from '../../../app/Dependencies';
import type { ConsoleContext } from '../../../entity/session/ConsoleSession';
import { defaultFinanceColumns, type FinanceColumnKey, type FinanceReconciliationQuery } from '../model/Finance';
import { financeReconciliationKey } from './FinanceQueryKey';
import { useFinanceNavigationViewModel } from './NavigationViewModel';

const removedQueryKeys = ['q', 'reconPeriod', 'channel', 'mall', 'status', 'difference', 'tab'] as const;

export function useReconciliationViewModel(context: ConsoleContext, dependencies: FinanceDependencies) {
  const [search, setSearch] = useSearchParams();
  const [selectedRows, setSelectedRows] = useState<ReadonlySet<string>>(new Set());
  const [visibleColumns, setVisibleColumns] = useState<ReadonlySet<FinanceColumnKey>>(defaultFinanceColumns);
  const [columnsOpen, setColumnsOpen] = useState(false);
  const scope = `${context.scope.kind}:${context.scope.id}`;
  const previousScope = useRef(scope);
  const cursor = search.get('cursor') ?? undefined;
  const queryInput: FinanceReconciliationQuery = { limit: readLimit(search.get('limit')), ...(cursor === undefined ? {} : { cursor }) };
  const query = useQuery({ queryKey: financeReconciliationKey(context, queryInput), queryFn: ({ signal }) => dependencies.readReconciliations.execute(context, queryInput, signal) });
  const page = query.data;
  const selectedId = search.get('selected') ?? undefined;
  const selected = page?.items.find((row) => row.id === selectedId);

  useEffect(() => {
    const scopeChanged = previousScope.current !== scope;
    previousScope.current = scope;
    const stale = removedQueryKeys.some((key) => search.has(key)) || (search.has('limit') && search.get('limit') !== '20');
    if (!scopeChanged && !stale) return;
    setSearch((current) => {
      const next = new URLSearchParams(current);
      removedQueryKeys.forEach((key) => next.delete(key));
      if (next.get('limit') !== '20') next.delete('limit');
      if (scopeChanged) { next.delete('cursor'); next.delete('selected'); }
      return next;
    }, { replace: true });
  }, [scope, search, setSearch]);

  useEffect(() => {
    if (!page) return;
    const ids = new Set(page.items.map((row) => row.id));
    setSelectedRows((current) => new Set([...current].filter((id) => ids.has(id))));
  }, [page]);

  const updateSearch = useCallback((mutate: (next: URLSearchParams) => void) => {
    setSearch((current) => { const next = new URLSearchParams(current); mutate(next); return next; });
  }, [setSearch]);
  const toggleRow = (id: string) => setSelectedRows((current) => { const next = new Set(current); next.has(id) ? next.delete(id) : next.add(id); return next; });
  const toggleAll = () => setSelectedRows((current) => {
    if (!page) return current;
    const next = new Set(current);
    const all = page.items.every((row) => next.has(row.id));
    page.items.forEach((row) => { all ? next.delete(row.id) : next.add(row.id); });
    return next;
  });
  const toggleColumn = (key: FinanceColumnKey) => setVisibleColumns((current) => { const next = new Set(current); next.has(key) ? next.delete(key) : next.add(key); return next; });
  const setCursor = (nextCursor?: string) => updateSearch((next) => { nextCursor ? next.set('cursor', nextCursor) : next.delete('cursor'); next.delete('selected'); });
  const setLimit = (limit: 20 | 50) => updateSearch((next) => { limit === 50 ? next.delete('limit') : next.set('limit', String(limit)); next.delete('cursor'); next.delete('selected'); });

  return Object.freeze({
    navigation: useFinanceNavigationViewModel(context, 'reconciliations'),
    page,
    selected,
    selectedRows,
    visibleColumns,
    columnsOpen,
    limit: queryInput.limit,
    cursor,
    condition: queryCondition({ pending: query.isPending, fetching: query.isFetching, error: query.error, hasData: page !== undefined, empty: page?.items.length === 0 }),
    error: safeQueryError(query.error),
    fetching: query.isFetching,
    actions: Object.freeze({
      refresh: () => { void query.refetch(); },
      toggleRow,
      toggleAll,
      toggleColumn,
      toggleColumns: () => setColumnsOpen((open) => !open),
      closeColumns: () => setColumnsOpen(false),
      open: (id: string) => updateSearch((next) => next.set('selected', id)),
      close: () => updateSearch((next) => next.delete('selected')),
      next: (nextCursor: string) => setCursor(nextCursor),
      first: () => setCursor(),
      limit: setLimit,
    }),
  });
}

function readLimit(value: string | null): 20 | 50 { return value === '20' ? 20 : 50; }
export type ReconciliationViewModel = ReturnType<typeof useReconciliationViewModel>;
