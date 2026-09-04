import { useDependencies } from '../../../app/DependencyContext';
import { useConsoleContext } from '../../../entity/session/ConsoleContext';
import { useStepup } from '../../../entity/session/StepupContext';
import { useRouteTitle } from '../../../shared/ui/RouteTitle';
import { ReconciliationPage } from '../view/ReconciliationPage';
import { useReconciliationViewModel } from '../viewmodel/ReconciliationViewModel';

export function Component() {
  const context = useConsoleContext();
  const dependencies = useDependencies();
  const stepup = useStepup();
  const model = useReconciliationViewModel(context, dependencies.finance, stepup.request);
  return <ReconciliationPage title={useRouteTitle('对账')} model={model} />;
}
