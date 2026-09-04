import { useDependencies } from '../../../app/DependencyContext';
import { useConsoleContext } from '../../../entity/session/ConsoleContext';
import { useStepup } from '../../../entity/session/StepupContext';
import { useRouteTitle } from '../../../shared/ui/RouteTitle';
import { SectionPage } from '../view/SectionPage';
import { useFinanceImportViewModel } from '../viewmodel/FinanceImportViewModel';
import { useStatementViewModel } from '../viewmodel/StatementViewModel';

export function Component() {
  const context = useConsoleContext();
  const dependencies = useDependencies();
  const stepup = useStepup();
  const model = useStatementViewModel(context, dependencies.finance, stepup.request);
  const importing = useFinanceImportViewModel(context, dependencies.finance, stepup.request);
  return <SectionPage title={useRouteTitle('账单')} model={model} importing={importing} />;
}
