import { useDependencies } from '../../../app/DependencyContext';
import { useConsoleContext } from '../../../entity/session/ConsoleContext';
import { useRouteTitle } from '../../../shared/ui/RouteTitle';
import { AuditPage } from '../view/AuditPage';
import { useAuditViewModel } from '../viewmodel/AuditViewModel';

export function Component() {
  const context = useConsoleContext();
  const dependencies = useDependencies();
  const model = useAuditViewModel(context, dependencies.finance);
  return <AuditPage title={useRouteTitle('财务审计')} model={model} />;
}
