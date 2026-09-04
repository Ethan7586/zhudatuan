import { useDependencies } from '../../../../app/DependencyContext';
import { useConsoleContext } from '../../../../entity/session/ConsoleContext';
import { useStepup } from '../../../../entity/session/StepupContext';
import { useRouteTitle } from '../../../../shared/ui/RouteTitle';
import { NotificationPage } from '../view/NotificationPage';
import { useNotificationViewModel } from '../viewmodel/NotificationViewModel';

export function Component() {
  const context = useConsoleContext();
  return <NotificationPage title={useRouteTitle('通知管理')} model={useNotificationViewModel(context, useDependencies().notification, useStepup().request)} />;
}
