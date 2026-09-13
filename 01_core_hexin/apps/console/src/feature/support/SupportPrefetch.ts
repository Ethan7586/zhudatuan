import type { QueryClient } from '@tanstack/react-query';
import type { ConsoleContext } from '../../entity/session/ConsoleSession';
import { readCases, supportCaseKey } from './SupportQuery';

export const SUPPORT_PREFETCH_STALE_TIME_MS = 30_000;

export function prefetchSupport(queryClient: QueryClient, context: ConsoleContext): Promise<void> | undefined {
  if (!context.session.capabilities.includes('support.cases.read')) return undefined;
  const queryKey = supportCaseKey(context);
  const state = queryClient.getQueryState(queryKey);
  if (state?.data !== undefined || state?.fetchStatus === 'fetching' || state?.status === 'error') return undefined;
  return queryClient.prefetchQuery({
    queryKey,
    queryFn: ({ signal }) => readCases(context, undefined, signal),
    staleTime: SUPPORT_PREFETCH_STALE_TIME_MS,
    retry: false,
  });
}
