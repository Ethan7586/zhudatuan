import { OP_RUNTIME_JOBS_READ } from '@shop/contract/ids';
import { safeQueryError } from '@shop/presentation';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router';
import type { TaskDependencies } from '../../../app/Dependencies';
import type { ConsoleContext } from '../../../entity/session/ConsoleSession';
import { canUseOperation } from '../../../shared/security/OperationAccess';
import { scopeRoutePath } from '../../../shared/url/ScopePath';
import type { Task } from '../model/Task';
import { taskCategory, taskDestination } from './TaskNavigation';

export function useTaskIndicatorViewModel(context: ConsoleContext, dependencies: TaskDependencies) {
  const navigate = useNavigate();
  const allowed = canUseOperation(context, OP_RUNTIME_JOBS_READ) && context.session.assurance.level >= 2;
  const query = useQuery({
    queryKey: ['console', context.scope.kind, context.scope.id, context.session.accessVersion, OP_RUNTIME_JOBS_READ, { limit: 20 }],
    queryFn: ({ signal }) => dependencies.list.execute(context, { limit: 20 }, signal),
    enabled: allowed,
    refetchInterval: (current) => current.state.data?.items.some((task) => active(task)) ? 3_000 : 15_000,
  });
  const items = query.data?.items ?? Object.freeze([]);
  const relevant = items.filter((task) => active(task) || task.state === 'failed').slice(0, 5).map((task) => {
    const destination = taskDestination(context, task);
    return Object.freeze({ ...task, category: taskCategory(task), destination: destination.label });
  });
  return Object.freeze({
    items: relevant,
    active: items.filter(active).length,
    failed: items.filter((task) => task.state === 'failed').length,
    loading: query.isPending && allowed,
    denied: !allowed,
    error: allowed ? safeQueryError(query.error) : undefined,
    actions: Object.freeze({
      refresh: () => { if (allowed) void query.refetch(); },
      center: () => { void navigate(scopeRoutePath(context.scope, 'consoletasks')); },
      source: (task: Task) => { void navigate(taskDestination(context, task).path); },
    }),
  });
}

function active(task: Task): boolean {
  return ['queued', 'validating', 'ready', 'running'].includes(task.state);
}

export type TaskIndicatorViewModel = ReturnType<typeof useTaskIndicatorViewModel>;
