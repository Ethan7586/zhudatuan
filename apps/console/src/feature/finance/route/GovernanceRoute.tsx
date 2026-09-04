import { useDependencies } from '../../../app/DependencyContext';
import { useConsoleContext } from '../../../entity/session/ConsoleContext';
import { useStepup } from '../../../entity/session/StepupContext';
import { useRouteTitle } from '../../../shared/ui/RouteTitle';
import { GovernancePage } from '../view/GovernancePage';
import { usePolicyViewModel } from '../viewmodel/PolicyViewModel';

export function Component() {
  const context = useConsoleContext();
  const dependencies = useDependencies();
  const stepup = useStepup();
  const model = usePolicyViewModel(context, dependencies.finance, dependencies.approval, stepup.request);
  return <GovernancePage title={useRouteTitle('规则与治理')} model={model} />;
}
