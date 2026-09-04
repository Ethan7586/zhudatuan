import { useOutletContext } from 'react-router';
import { useDependencies } from '../../../../app/DependencyContext';
import { AssurancePrompt } from '../../../../entity/session/AssurancePrompt';
import { useConsoleContext } from '../../../../entity/session/ConsoleContext';
import type { ConsoleNavigationNode, ConsoleScope } from '../../../../entity/session/ConsoleSession';
import { useStepup } from '../../../../entity/session/StepupContext';
import { useRouteTitle } from '../../../../shared/ui/RouteTitle';
import { navigationPath } from '../../../../shared/url/NavigationPath';
import { RiskPage } from '../view/RiskPage';
import { useRiskViewModel } from '../viewmodel/RiskViewModel';

export function Component() {
  const context = useConsoleContext();
  const title = useRouteTitle('系统治理台');
  const model = useRiskViewModel(context, useDependencies().risk, useStepup().request);
  const { nodes, scope } = useOutletContext<Readonly<{ nodes: readonly ConsoleNavigationNode[]; scope: ConsoleScope }>>();
  if (model.needsReadStepup) return <AssurancePrompt title={title} description="系统治理台包含风险策略、命中证据与人员标识。请完成短信二次验证，成功后自动返回当前数据范围。" />;
  const notification = nodes.find((node) => node.component === 'notification' || node.title === '通知管理');
  return <RiskPage title={title} {...(notification ? { notificationHref: navigationPath(notification, scope) } : {})} model={model} />;
}
