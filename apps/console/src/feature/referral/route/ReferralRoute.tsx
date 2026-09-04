import { useDependencies } from '../../../app/DependencyContext';
import { useConsoleContext } from '../../../entity/session/ConsoleContext';
import { useStepup } from '../../../entity/session/StepupContext';
import { useRouteTitle } from '../../../shared/ui/RouteTitle';
import { ReferralPage } from '../view/ReferralPage';
import { useReferralViewModel } from '../viewmodel/ReferralViewModel';

export function Component() {
  const context = useConsoleContext();
  const dependencies = useDependencies();
  const stepup = useStepup();
  return <ReferralPage title={useRouteTitle('分销返佣')} model={useReferralViewModel(context, dependencies.referral, stepup.request)} />;
}
