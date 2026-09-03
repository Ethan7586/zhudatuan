import { queryCondition, safeQueryError } from '@shop/presentation';
import { useQuery } from '@tanstack/react-query';
import type { FinanceDependencies } from '../../../app/Dependencies';
import type { ConsoleContext } from '../../../entity/session/ConsoleSession';
import { financeOverviewKey } from './FinanceQueryKey';
import { useFinanceNavigationViewModel } from './NavigationViewModel';

export function useOverviewViewModel(context: ConsoleContext, dependencies: FinanceDependencies) {
  const query = useQuery({ queryKey: financeOverviewKey(context), queryFn: ({ signal }) => dependencies.readOverview.execute(context, signal), staleTime: 30_000 });
  return Object.freeze({
    navigation: useFinanceNavigationViewModel(context, 'overview'),
    data: query.data,
    condition: queryCondition({ pending: query.isPending, fetching: query.isFetching, error: query.error, hasData: query.data !== undefined, empty: query.data?.items.length === 0 }),
    error: safeQueryError(query.error),
    fetching: query.isFetching,
    refresh: () => { void query.refetch(); },
  });
}

export type OverviewViewModel = ReturnType<typeof useOverviewViewModel>;
