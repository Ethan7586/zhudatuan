import { useParams } from 'react-router';
import { useDependencies } from '../../../app/DependencyContext';
import { useConsoleContext } from '../../../entity/session/ConsoleContext';
import { useStepup } from '../../../entity/session/StepupContext';
import { useRouteTitle } from '../../../shared/ui/RouteTitle';
import { importKinds, type ImportKind } from '../model/ImportTask';
import { TaskPage } from '../view/TaskPage';
import { useTaskViewModel } from '../viewmodel/TaskViewModel';
export function Component() {
  const params = useParams();
  const kind = importKinds.includes(params.kind as ImportKind) ? (params.kind as ImportKind) : undefined;
  const id = params.jobId ?? '';
  if (kind === undefined || !id) throw new Response('IMPORT_ROUTE_INVALID', { status: 404 });
  const context = useConsoleContext();
  return <TaskPage title={useRouteTitle('长任务中心')} model={useTaskViewModel(context, useDependencies().task, kind, id, useStepup().request)} />;
}
