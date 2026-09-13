import type { QueryClient } from '@tanstack/react-query';
import type { ConsoleContext } from '../../entity/session/ConsoleSession';
import { financeKey, readFinance } from './FinanceQuery';
import { financeReconciliationKey, readFinanceReconciliations, type FinanceReconciliationQuery } from './FinanceWorkspaceQuery';

export const FINANCE_PREFETCH_STALE_TIME_MS = 30_000;

const defaultReconciliationQuery: FinanceReconciliationQuery = Object.freeze({
  q: '', period: '', channel: '', mall: '', status: '', difference: '', limit: 50,
});

export async function prefetchFinance(queryClient: QueryClient, context: ConsoleContext): Promise<void> {
  if (context.session.capabilities.includes('finance.reconciliations.read')) {
    const queryKey = financeReconciliationKey(context, defaultReconciliationQuery);
    const state = queryClient.getQueryState(queryKey);
    if (state?.data === undefined && state?.fetchStatus !== 'fetching' && state?.status !== 'error') {
      await queryClient.prefetchQuery({
        queryKey,
        queryFn: ({ signal }) => readFinanceReconciliations(context, defaultReconciliationQuery, signal),
        staleTime: FINANCE_PREFETCH_STALE_TIME_MS,
        retry: false,
      });
    }
  }
  if (context.session.capabilities.includes('finance.overview.read')) {
    const queryKey = financeKey(context);
    const state = queryClient.getQueryState(queryKey);
    if (state?.data === undefined && state?.fetchStatus !== 'fetching' && state?.status !== 'error') {
      await queryClient.prefetchQuery({
        queryKey,
        queryFn: ({ signal }) => readFinance(context, signal),
        staleTime: FINANCE_PREFETCH_STALE_TIME_MS,
        retry: false,
      });
    }
  }
}
