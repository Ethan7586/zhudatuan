import { useDependencies } from '../../../app/DependencyContext';
import { useConsoleContext } from '../../../entity/session/ConsoleContext';
import { useStepup } from '../../../entity/session/StepupContext';
import { useRouteTitle } from '../../../shared/ui/RouteTitle';
import { ApprovalPage } from '../view/ApprovalPage';
import { useApprovalViewModel } from '../viewmodel/ApprovalViewModel';

export function Component() {
  const context = useConsoleContext();
  const dependencies = useDependencies();
  const stepup = useStepup();
  return <ApprovalPage title={useRouteTitle('审批中心')} model={useApprovalViewModel(context, dependencies.approval, stepup.request)} />;
}
