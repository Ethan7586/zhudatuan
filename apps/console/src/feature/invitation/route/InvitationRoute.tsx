import { useDependencies } from '../../../app/DependencyContext';
import { useConsoleContext } from '../../../entity/session/ConsoleContext';
import { useRouteTitle } from '../../../shared/ui/RouteTitle';
import { InvitationPage } from '../view/InvitationPage';
import { useInvitationViewModel } from '../viewmodel/InvitationViewModel';

export function Component() {
  const context = useConsoleContext();
  const dependencies = useDependencies();
  return <InvitationPage title={useRouteTitle('员工邀请')} model={useInvitationViewModel(context, dependencies.invitation)} />;
}
