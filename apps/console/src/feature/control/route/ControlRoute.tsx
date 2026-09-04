import { useDependencies } from '../../../app/DependencyContext';
import { useConsoleContext } from '../../../entity/session/ConsoleContext';
import { useStepup } from '../../../entity/session/StepupContext';
import { useRouteTitle } from '../../../shared/ui/RouteTitle';
import { ControlPage } from '../view/ControlPage';
import { useControlViewModel } from '../viewmodel/ControlViewModel';

export function Component() {
  const context = useConsoleContext();
  const dependencies = useDependencies();
  const stepup = useStepup();
  const model = useControlViewModel(context, dependencies.control, stepup.request);
  return <ControlPage title={useRouteTitle(model.title)} model={model} />;
}
