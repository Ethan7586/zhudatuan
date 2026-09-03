import type { FinanceDependencies } from '../../../app/Dependencies';
import { useDependencies } from '../../../app/DependencyContext';
import { useConsoleContext } from '../../../entity/session/ConsoleContext';
import type { ConsoleContext } from '../../../entity/session/ConsoleSession';
import { useRouteTitle } from '../../../shared/ui/RouteTitle';
import { ProfessionalPage } from '../view/ProfessionalPage';
import type { SectionViewModel } from '../viewmodel/SectionViewModel';

export function SectionRoute({ title, useModel }: Readonly<{ title: string; useModel: (context: ConsoleContext, dependencies: FinanceDependencies) => SectionViewModel }>) {
  const context = useConsoleContext();
  const dependencies = useDependencies();
  const model = useModel(context, dependencies.finance);
  return <ProfessionalPage title={useRouteTitle(title)} model={model} />;
}
