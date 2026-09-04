import { useDependencies } from '../../../app/DependencyContext';
import { useConsoleContext } from '../../../entity/session/ConsoleContext';
import { scopeRoutePath } from '../../../shared/url/ScopePath';
import { useRouteTitle } from '../../../shared/ui/RouteTitle';
import { useCallback } from 'react';
import { useNavigate } from 'react-router';
import type { CockpitDestination } from '../model/Cockpit';
import { CockpitPage } from '../view/CockpitPage';
import { useCockpitViewModel } from '../viewmodel/CockpitViewModel';
import '../view/Cockpit.css';

export function Component() {
  const title = useRouteTitle('经营驾驶舱');
  const context = useConsoleContext();
  const dependencies = useDependencies();
  const navigate = useNavigate();
  const open = useCallback(
    (destination: CockpitDestination) => {
      if (destination.kind === 'product') void navigate(scopeRoutePath(context.scope, 'consoleproductdetail', { productId: destination.productId }));
      else if (destination.kind === 'orders') void navigate(scopeRoutePath(context.scope, 'consoleorders'));
      else void navigate(scopeRoutePath(context.scope, destination.target === 'reports' ? 'consolereporting' : 'consoleorders'));
    },
    [context.scope, navigate]
  );
  return <CockpitPage title={title} model={useCockpitViewModel(context, dependencies.cockpit, open)} />;
}
