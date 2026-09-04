import type { FinanceDependencies } from '../../../app/Dependencies';
import { useDependencies } from '../../../app/DependencyContext';
import { useConsoleContext } from '../../../entity/session/ConsoleContext';
import type { ConsoleContext } from '../../../entity/session/ConsoleSession';
import { useRouteTitle } from '../../../shared/ui/RouteTitle';
import { useStepup } from '../../../entity/session/StepupContext';
import { SectionPage } from '../view/SectionPage';
import type { SectionViewModel } from '../viewmodel/SectionViewModel';

export function SectionRoute({ title, useModel }: Readonly<{ title: string; useModel: (context: ConsoleContext, dependencies: FinanceDependencies, requestStepup: () => void) => SectionViewModel }>) {
  const context = useConsoleContext();
  const dependencies = useDependencies();
  const stepup = useStepup();
  const model = useModel(context, dependencies.finance, stepup.request);
  return <SectionPage title={useRouteTitle(title)} model={model} />;
}
