import { useOutletContext } from 'react-router';
import { useConsoleContext } from '../../../entity/session/ConsoleContext';
import type { ConsoleNavigationNode, ConsoleScope } from '../../../entity/session/ConsoleSession';
import { useRouteTitle } from '../../../shared/ui/RouteTitle';
import { SettingsPage } from '../view/SettingsPage';
import { createSettingsViewModel } from '../viewmodel/SettingsViewModel';

interface SettingsRouteContext {
  readonly nodes: readonly ConsoleNavigationNode[];
  readonly scope: ConsoleScope;
}

export function Component() {
  const context = useConsoleContext();
  const route = useOutletContext<SettingsRouteContext>();
  const model = createSettingsViewModel(route.nodes, route.scope, context.session.assurance.level);
  return <SettingsPage title={useRouteTitle('设置')} model={model} />;
}
