import { useDependencies } from '../../../app/DependencyContext';
import { useConsoleContext } from '../../../entity/session/ConsoleContext';
import { useStepup } from '../../../entity/session/StepupContext';
import { useRouteTitle } from '../../../shared/ui/RouteTitle';
import { ExperiencePage } from '../view/ExperiencePage';
import { useApplicationViewModel } from '../viewmodel/ApplicationViewModel';
import '../view/Workspace.css';
import '../view/Table.css';
import '../view/Dialogs.css';
import '../view/Responsive.css';

export function Component() {
  const context = useConsoleContext();
  const dependencies = useDependencies();
  const stepup = useStepup();
  const model = useApplicationViewModel(context, dependencies.experience, stepup.request);
  return <ExperiencePage title={useRouteTitle(model.presentation.title)} model={model} />;
}
