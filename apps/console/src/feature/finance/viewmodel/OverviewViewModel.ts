import { queryCondition, safeQueryError } from '@shop/presentation';
import { OP_FINANCE_FACETS_READ, OP_FINANCE_OVERVIEW_READ } from '@shop/contract/ids';
import { useQuery } from '@tanstack/react-query';
import { useRef, useState } from 'react';
import type { FinanceDependencies } from '../../../app/Dependencies';
import type { ConsoleContext } from '../../../entity/session/ConsoleSession';
import { canUseOperation, requiredAssurance } from '../../../shared/security/OperationAccess';
import { useFinancePrefetch } from './FinancePrefetch';
import { financeFacetKey, financeOverviewKey } from './FinanceQueryKey';
import { useFinanceNavigationViewModel } from './NavigationViewModel';

export function useOverviewViewModel(context: ConsoleContext, dependencies: FinanceDependencies) {
  const allowed = canUseOperation(context, OP_FINANCE_OVERVIEW_READ);
  const ready = allowed && context.session.assurance.level >= requiredAssurance(OP_FINANCE_OVERVIEW_READ);
  const query = useQuery({ queryKey: financeOverviewKey(context), queryFn: ({ signal }) => dependencies.readOverview.execute(context, signal), enabled: ready, staleTime: 30_000 });
  const facetAllowed = canUseOperation(context, OP_FINANCE_FACETS_READ);
  const facetReady = facetAllowed && context.session.assurance.level >= requiredAssurance(OP_FINANCE_FACETS_READ);
  const facets = useQuery({ queryKey: financeFacetKey(context), queryFn: ({ signal }) => dependencies.readFacets.execute(context, signal), enabled: facetReady, staleTime: 30_000 });
  useFinancePrefetch(context, dependencies, 'overview', query.data !== undefined);
  const [refreshResult, setRefreshResult] = useState<string>();
  const refreshFlight = useRef<Promise<void> | null>(null);
  const refresh = () => {
    if (refreshFlight.current) return;
    setRefreshResult(undefined);
    if (!ready) return;
    const flight = Promise.allSettled([query.refetch(), ...(facetReady ? [facets.refetch()] : [])])
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
    condition: allowed ? (ready ? queryCondition({ pending: query.isPending, fetching: query.isFetching, error: query.error, hasData: query.data !== undefined, empty: query.data?.items.length === 0 }) : 'forbidden') : 'forbidden',
    error: allowed ? safeQueryError(query.error) : '当前账号没有读取财务总览的权限。',
    needsStepup: allowed && !ready,
    fetching: query.isFetching || facets.isFetching,
    lastUpdated: query.dataUpdatedAt > 0 ? new Date(query.dataUpdatedAt).toISOString() : null,
    refreshResult,
    facets: Object.freeze({
      data: facets.data,
      condition: facetAllowed ? (facetReady ? queryCondition({ pending: facets.isPending, fetching: facets.isFetching, error: facets.error, hasData: facets.data !== undefined, empty: false }) : 'forbidden') : 'forbidden',
      error: facetAllowed ? safeQueryError(facets.error) : '当前账号没有读取财务筛选项的权限。',
      retry: () => {
        if (facetReady) void facets.refetch();
      },
    }),
    refresh,
  });
}

export type OverviewViewModel = ReturnType<typeof useOverviewViewModel>;
