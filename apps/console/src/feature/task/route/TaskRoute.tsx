import { useParams } from 'react-router';
import { useDependencies } from '../../../app/DependencyContext';
import { useConsoleContext } from '../../../entity/session/ConsoleContext';
import { useStepup } from '../../../entity/session/StepupContext';
import { useRouteTitle } from '../../../shared/ui/RouteTitle';
import { matchRoutePath } from '../../../generated/RouteBinding';
import { TaskPage } from '../view/TaskPage';
import { useTaskViewModel } from '../viewmodel/TaskViewModel';

export function Component() {
  const route = matchRoutePath(window.location.pathname);
  return route?.id === 'consoletasks' ? <TaskCenterRoute /> : <ImportTaskRoute />;
}

function TaskCenterRoute() {
  const context = useConsoleContext();
  return <TaskPage title={useRouteTitle('我的任务')} model={useTaskViewModel(context, useDependencies().task, useStepup().request)} />;
}

function ImportTaskRoute() {
  const params = useParams();
  const dependencies = useDependencies();
  const kind = params.kind !== undefined && dependencies.task.registry.has(params.kind) ? params.kind : undefined;
  const id = params.jobId ?? '';
  if (kind === undefined || !id) throw new Response('IMPORT_ROUTE_INVALID', { status: 404 });
  const context = useConsoleContext();
  return <TaskPage title={useRouteTitle('导入任务详情')} model={useTaskViewModel(context, dependencies.task, useStepup().request, { type: 'import', id })} />;
}
