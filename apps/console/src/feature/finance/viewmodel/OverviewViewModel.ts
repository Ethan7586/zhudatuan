import { queryCondition, safeQueryError } from '@shop/presentation';
import { OP_FINANCE_FACETS_READ } from '@shop/contract/ids';
import { useQuery } from '@tanstack/react-query';
import { useRef, useState } from 'react';
import type { FinanceDependencies } from '../../../app/Dependencies';
import type { ConsoleContext } from '../../../entity/session/ConsoleSession';
import { canUseOperation } from '../../../shared/security/OperationAccess';
import { useFinancePrefetch } from './FinancePrefetch';
import { financeFacetKey, financeOverviewKey } from './FinanceQueryKey';
import { useFinanceNavigationViewModel } from './NavigationViewModel';

export function useOverviewViewModel(context: ConsoleContext, dependencies: FinanceDependencies) {
  const query = useQuery({ queryKey: financeOverviewKey(context), queryFn: ({ signal }) => dependencies.readOverview.execute(context, signal), staleTime: 30_000 });
  const facetAllowed = canUseOperation(context, OP_FINANCE_FACETS_READ);
  const facets = useQuery({ queryKey: financeFacetKey(context), queryFn: ({ signal }) => dependencies.readFacets.execute(context, signal), enabled: facetAllowed, staleTime: 30_000 });
  useFinancePrefetch(context, dependencies, 'overview', query.data !== undefined);
  const [refreshResult, setRefreshResult] = useState<string>();
  const refreshFlight = useRef<Promise<void> | null>(null);
  const refresh = () => {
    if (refreshFlight.current) return;
    setRefreshResult(undefined);
    const flight = Promise.allSettled([query.refetch(), ...(facetAllowed ? [facets.refetch()] : [])])
      .then((results) => {
        setRefreshResult(results.every(({ status }) => status === 'fulfilled') ? '财务总览已刷新。' : '部分财务数据刷新失败，可单独重试对应区域。');
      })
      .finally(() => {
        refreshFlight.current = null;
      });
    refreshFlight.current = flight;
  };
  return Object.freeze({
    navigation: useFinanceNavigationViewModel(context, 'overview'),
    data: query.data,
    condition: queryCondition({ pending: query.isPending, fetching: query.isFetching, error: query.error, hasData: query.data !== undefined, empty: query.data?.items.length === 0 }),
    error: safeQueryError(query.error),
    fetching: query.isFetching || facets.isFetching,
    lastUpdated: query.dataUpdatedAt > 0 ? new Date(query.dataUpdatedAt).toISOString() : null,
    refreshResult,
    facets: Object.freeze({
      data: facets.data,
      condition: facetAllowed ? queryCondition({ pending: facets.isPending, fetching: facets.isFetching, error: facets.error, hasData: facets.data !== undefined, empty: false }) : 'forbidden',
      error: facetAllowed ? safeQueryError(facets.error) : '当前账号没有读取财务筛选项的权限。',
      retry: () => {
        if (facetAllowed) void facets.refetch();
      },
    }),
    refresh,
  });
}

export type OverviewViewModel = ReturnType<typeof useOverviewViewModel>;
