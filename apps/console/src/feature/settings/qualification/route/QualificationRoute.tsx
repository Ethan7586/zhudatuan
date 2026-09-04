import { useDependencies } from '../../../../app/DependencyContext';
import { useConsoleContext } from '../../../../entity/session/ConsoleContext';
import { useStepup } from '../../../../entity/session/StepupContext';
import { useRouteTitle } from '../../../../shared/ui/RouteTitle';
import { QualificationPage } from '../view/QualificationPage';
import { useQualificationViewModel } from '../viewmodel/QualificationViewModel';

export function Component() {
  const context = useConsoleContext();
  return <QualificationPage title={useRouteTitle('资格管理')} model={useQualificationViewModel(context, useDependencies().qualification, useStepup().request)} />;
}
