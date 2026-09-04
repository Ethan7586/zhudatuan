import { useDependencies } from '../../../../app/DependencyContext';
import { useConsoleContext } from '../../../../entity/session/ConsoleContext';
import { useStepup } from '../../../../entity/session/StepupContext';
import { useRouteTitle } from '../../../../shared/ui/RouteTitle';
import { MemberPage } from '../view/MemberPage';
import { useMemberViewModel } from '../viewmodel/MemberViewModel';

export function Component() {
  const context = useConsoleContext();
  const dependencies = useDependencies();
  const stepup = useStepup();
  return <MemberPage title={useRouteTitle('成员管理')} model={useMemberViewModel(context, dependencies.member, stepup.request, () => window.location.reload())} />;
}
