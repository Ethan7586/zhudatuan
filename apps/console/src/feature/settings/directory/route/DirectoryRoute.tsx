import { useDependencies } from '../../../../app/DependencyContext';
import { useConsoleContext } from '../../../../entity/session/ConsoleContext';
import { useStepup } from '../../../../entity/session/StepupContext';
import { useRouteTitle } from '../../../../shared/ui/RouteTitle';
import { DirectoryPage } from '../view/DirectoryPage';
import { useDirectoryViewModel } from '../viewmodel/DirectoryViewModel';

export function Component() {
  const context = useConsoleContext();
  return <DirectoryPage title={useRouteTitle('通讯录同步')} model={useDirectoryViewModel(context, useDependencies().directory, useStepup().request)} />;
}
