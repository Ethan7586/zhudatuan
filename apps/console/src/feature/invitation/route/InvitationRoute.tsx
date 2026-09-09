import { useDependencies } from '../../../app/DependencyContext';
import { useConsoleContext } from '../../../entity/session/ConsoleContext';
import { useStepup } from '../../../entity/session/StepupContext';
import { useRouteTitle } from '../../../shared/ui/RouteTitle';
import { InvitationPage } from '../view/InvitationPage';
import { useInvitationViewModel } from '../viewmodel/InvitationViewModel';

export function Component() {
  const context = useConsoleContext();
  const dependencies = useDependencies();
  const stepup = useStepup();
  return <InvitationPage title={useRouteTitle('邀请管理')} model={useInvitationViewModel(context, dependencies.invitation, stepup.request)} />;
}
