import type { QueryClient } from '@tanstack/react-query';
import type { ConsoleContext } from '../../entity/session/ConsoleSession';
import { applicationKey, readApplications } from './ApplicationQuery';

export const APPLICATION_PREFETCH_STALE_TIME_MS = 60_000;

export function prefetchApplications(queryClient: QueryClient, context: ConsoleContext): Promise<void> | undefined {
  if (!context.session.capabilities.includes('experience.applications.read')) return undefined;
  const queryKey = applicationKey(context);
  const state = queryClient.getQueryState(queryKey);
  if (state?.data !== undefined || state?.fetchStatus === 'fetching' || state?.status === 'error') return undefined;
  return queryClient.prefetchQuery({
    queryKey,
    queryFn: ({ signal }) => readApplications(context, undefined, signal),
    staleTime: APPLICATION_PREFETCH_STALE_TIME_MS,
    retry: false,
  });
}
