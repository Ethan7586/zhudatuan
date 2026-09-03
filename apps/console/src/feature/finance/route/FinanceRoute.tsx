import { useDependencies } from '../../../app/DependencyContext';
import { useConsoleContext } from '../../../entity/session/ConsoleContext';
import { useRouteTitle } from '../../../shared/ui/RouteTitle';
import { OverviewPage } from '../view/OverviewPage';
import { useOverviewViewModel } from '../viewmodel/OverviewViewModel';

export function Component() {
  const context = useConsoleContext();
  const dependencies = useDependencies();
  const model = useOverviewViewModel(context, dependencies.finance);
  return <OverviewPage title={useRouteTitle('财务总览')} model={model} />;
}
