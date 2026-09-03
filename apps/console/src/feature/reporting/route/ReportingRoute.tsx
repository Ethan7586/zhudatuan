import { useDependencies } from '../../../app/DependencyContext';
import { useConsoleContext } from '../../../entity/session/ConsoleContext';
import { useStepup } from '../../../entity/session/StepupContext';
import { useRouteTitle } from '../../../shared/ui/RouteTitle';
import { ReportingPage } from '../view/ReportingPage';
import { useReportingViewModel } from '../viewmodel/ReportingViewModel';
import '../view/Reporting.css';

export function Component() {
  const title = useRouteTitle('数据报表');
  const context = useConsoleContext();
  const dependencies = useDependencies();
  const stepup = useStepup();
  return <ReportingPage title={title} model={useReportingViewModel(context, dependencies.reporting, stepup.request)} />;
}
