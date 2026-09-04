import { useDependencies } from '../../../../app/DependencyContext';
import { useConsoleContext } from '../../../../entity/session/ConsoleContext';
import { useStepup } from '../../../../entity/session/StepupContext';
import { useRouteTitle } from '../../../../shared/ui/RouteTitle';
import { PartnerPage } from '../view/PartnerPage';
import { usePartnerViewModel } from '../viewmodel/PartnerViewModel';
import { useCustomerViewModel } from '../viewmodel/CustomerViewModel';

export function Component() {
  const context = useConsoleContext();
  const dependencies = useDependencies().partner;
  const stepup = useStepup().request;
  const model = usePartnerViewModel(context, dependencies, stepup);
  const customer = useCustomerViewModel(context, dependencies, model.section === 'customer', stepup);
  return <PartnerPage title={useRouteTitle('供应商、客户与门店')} model={model} customer={customer} />;
}
