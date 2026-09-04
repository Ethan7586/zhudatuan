import { safeQueryError } from '@shop/presentation';
import { useQuery } from '@tanstack/react-query';
import type { ExperienceDependencies } from '../../../app/Dependencies';
import type { ConsoleContext } from '../../../entity/session/ConsoleSession';
import { applicationDetailKey } from './ExperienceQueryKey';

export function useExperienceDetailViewModel(context: ConsoleContext, dependencies: ExperienceDependencies, application?: string) {
  const query = useQuery({
    queryKey: applicationDetailKey(context, application ?? 'closed'),
    queryFn: ({ signal }) => dependencies.readDetail.execute(context, application ?? '', signal),
    enabled: application !== undefined,
    staleTime: 30_000,
  });
  return Object.freeze({ data: query.data, pending: query.isPending, failed: query.isError, error: safeQueryError(query.error), refresh: () => void query.refetch() });
}

export type ExperienceDetailViewModel = ReturnType<typeof useExperienceDetailViewModel>;
