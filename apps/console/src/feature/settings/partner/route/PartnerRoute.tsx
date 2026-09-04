import { useDependencies } from '../../../../app/DependencyContext';
import { useConsoleContext } from '../../../../entity/session/ConsoleContext';
import { useStepup } from '../../../../entity/session/StepupContext';
import { useRouteTitle } from '../../../../shared/ui/RouteTitle';
import { PartnerPage } from '../view/PartnerPage';
import { usePartnerViewModel } from '../viewmodel/PartnerViewModel';

export function Component() {
  const context = useConsoleContext();
  return <PartnerPage title={useRouteTitle('供应商与门店')} model={usePartnerViewModel(context, useDependencies().partner, useStepup().request)} />;
}
