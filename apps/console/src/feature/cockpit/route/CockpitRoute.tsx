import { useDependencies } from '../../../app/DependencyContext';
import { useConsoleContext } from '../../../entity/session/ConsoleContext';
import { scopePath } from '../../../shared/url/ScopePath';
import { useRouteTitle } from '../../../shared/ui/RouteTitle';
import { useCallback } from 'react';
import { useNavigate } from 'react-router';
import type { BusinessInsight } from '../model/Cockpit';
import { CockpitPage } from '../view/CockpitPage';
import { useCockpitViewModel } from '../viewmodel/CockpitViewModel';
import '../view/Cockpit.css';

export function Component() {
  const title = useRouteTitle('经营驾驶舱');
  const context = useConsoleContext();
  const dependencies = useDependencies();
  const navigate = useNavigate();
  const openInsight = useCallback((target: BusinessInsight['target']) => void navigate(scopePath(context.scope, target === 'reports' ? 'reporting' : 'orders')), [context.scope, navigate]);
  return <CockpitPage title={title} model={useCockpitViewModel(context, dependencies.cockpit, openInsight)} />;
}
