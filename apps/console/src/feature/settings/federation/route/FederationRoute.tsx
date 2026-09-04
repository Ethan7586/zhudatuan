import { useDependencies } from '../../../../app/DependencyContext';
import { useConsoleContext } from '../../../../entity/session/ConsoleContext';
import { useStepup } from '../../../../entity/session/StepupContext';
import { useRouteTitle } from '../../../../shared/ui/RouteTitle';
import { FederationPage } from '../view/FederationPage';
import { useFederationViewModel } from '../viewmodel/FederationViewModel';

export function Component() {
  const context = useConsoleContext();
  return <FederationPage title={useRouteTitle('登录方式')} model={useFederationViewModel(context, useDependencies().federation, useStepup().request)} />;
}
