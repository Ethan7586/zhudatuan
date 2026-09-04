import { useDependencies } from '../../../../app/DependencyContext';
import { useConsoleContext } from '../../../../entity/session/ConsoleContext';
import { useStepup } from '../../../../entity/session/StepupContext';
import { useRouteTitle } from '../../../../shared/ui/RouteTitle';
import { AccessPage } from '../view/AccessPage';
import { useAccessViewModel } from '../viewmodel/AccessViewModel';

export function Component() {
  const context = useConsoleContext();
  const dependencies = useDependencies();
  const stepup = useStepup();
  const model = useAccessViewModel(context, dependencies.access, stepup.request, () => window.location.reload());
  return <AccessPage title={useRouteTitle('权限中心')} model={model} currentMembership={context.session.membership} />;
}
