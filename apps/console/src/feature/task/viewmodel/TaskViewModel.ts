import { queryCondition, safeQueryError } from '@shop/presentation';
import { useQuery } from '@tanstack/react-query';
import { useCallback } from 'react';
import type { TaskDependencies } from '../../../app/Dependencies';
import type { ConsoleContext } from '../../../entity/session/ConsoleSession';
import type { ImportKind } from '../model/ImportTask';

export function useTaskViewModel(context: ConsoleContext, dependencies: TaskDependencies, kind: ImportKind, id: string, requestStepup: () => void) {
  const query = useQuery({
    queryKey: Object.freeze(['console', context.scope.kind, context.scope.id, context.session.accessVersion, `${kind}.imports.read`, id] as const),
    queryFn: ({ signal }) => dependencies.read.execute(context, kind, id, signal),
    refetchInterval: (current) => (terminal(current.state.data?.state) ? false : 3_000),
  });
  const refetch = query.refetch;
  const refresh = useCallback(() => {
    void refetch();
  }, [refetch]);
  const task = query.data;
  return Object.freeze({
    task,
    download: secureDownload(task?.report?.download),
    assurance: context.session.assurance.level,
    condition: queryCondition({ pending: query.isPending, fetching: query.isFetching, error: query.error, hasData: task !== undefined, empty: false }),
    error: safeQueryError(query.error),
    fetching: query.isFetching,
    actions: Object.freeze({ refresh, stepup: requestStepup }),
  });
}
function terminal(state?: string) {
  return state !== undefined && ['completed', 'failed', 'cancelled'].includes(state);
}
function secureDownload(value?: string): string | undefined {
  if (value === undefined) return undefined;
  try {
    const url = new URL(value, window.location.origin);
    return url.protocol === 'https:' || (url.protocol === 'http:' && url.origin === window.location.origin) ? url.toString() : undefined;
  } catch {
    return undefined;
  }
}
export type TaskViewModel = ReturnType<typeof useTaskViewModel>;
