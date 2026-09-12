import type { QueryClient } from '@tanstack/react-query';
import type { ConsoleContext } from '../../entity/session/ConsoleSession';
import { MEMBER_PREFETCH_STALE_TIME_MS, memberKey, readMembers } from './MemberQuery';

export function memberPrefetchAvailable(context: ConsoleContext): boolean {
  return context.scope.kind === 'mall' && context.session.capabilities.includes('member.members.read');
}

export function prefetchMembers(queryClient: QueryClient, context: ConsoleContext): Promise<void> | undefined {
  if (!memberPrefetchAvailable(context)) return undefined;
  const queryKey = memberKey(context);
  if (queryClient.getQueryData(queryKey) !== undefined || queryClient.getQueryState(queryKey)?.fetchStatus === 'fetching') return undefined;
  return queryClient.prefetchQuery({
    queryKey,
    queryFn: ({ signal }) => readMembers(context, undefined, signal),
    staleTime: MEMBER_PREFETCH_STALE_TIME_MS,
    retry: false,
  });
}
