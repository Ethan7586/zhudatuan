import { chineseSectionLabel, queryCondition, hasFailureCode, safeQueryError } from '@shop/presentation';
import type { OperationOutputFor } from '@shop/contract';
import { Button, ResourcePanel } from '@shop/design';
import { createFetchRiskCenterRead } from '@shop/sdk/risk';
import { useQuery } from '@tanstack/react-query';
import { Link, useOutletContext } from 'react-router';
import { AssurancePrompt } from '../../../entity/session/AssurancePrompt';
import { useConsoleContext } from '../../../entity/session/ConsoleContext';
import type { ConsoleNavigationNode, ConsoleScope } from '../../../entity/session/ConsoleSession';
import { consoleRequest } from '../../../shared/api/Client';

import { appConfig } from '../../../shared/config/AppConfig';
import { useRouteTitle } from '../../../shared/ui/RouteTitle';
import { navigationPath } from '../../../shared/url/NavigationPath';
import { RiskWorkspace } from './RiskWorkspace';
import './Risk.css';
import './RiskResponsive.css';

const centerRead = createFetchRiskCenterRead(appConfig.apiBaseUrl);

export function Component() {
  const context = useConsoleContext();
  const title = useRouteTitle('系统治理台');
  const { nodes, scope } = useOutletContext<Readonly<{ nodes: readonly ConsoleNavigationNode[]; scope: ConsoleScope }>>();
  const query = useQuery({
    queryKey: ['console', context.scope.kind, context.scope.id, context.session.accessVersion, 'risk.center.read'],
    queryFn: ({ signal }) => centerRead({ query: { limit: 100 } }, consoleRequest(context.scope, signal, context.session.accessVersion)),
    staleTime: 30_000,
  });
  if (hasFailureCode(query.error, 'STEPUP_REQUIRED')) {
    return <AssurancePrompt title={title} description="系统治理台包含风险策略、命中证据与人员标识。请完成短信二次验证后查看，成功后会自动回到当前数据范围。" />;
  }
  const data: OperationOutputFor<'risk.center.read'> | undefined = query.data;
  const condition = queryCondition({ pending: query.isPending, fetching: query.isFetching, error: query.error, hasData: data !== undefined, empty: false });
  const error = safeQueryError(query.error);
  const notification = nodes.find((node) => node.component === 'notification' || node.title === '通知管理');
  return (
    <ResourcePanel
      eyebrow={chineseSectionLabel('系统治理')}
      title={title}
      description="集中观察风险策略、策略回放与待复核事件；所有数据均来自当前组织范围的权威风险中心。"
      condition={condition}
      {...(error === undefined ? {} : { error })}
      retry={() => void query.refetch()}
      actions={
        <>
          <Button onPress={() => void query.refetch()} isDisabled={query.isFetching}>
            {query.isFetching ? '正在刷新…' : '刷新治理状态'}
          </Button>
          {notification === undefined ? null : (
            <Link className="risknotificationlink" to={navigationPath(notification, scope)}>
              进入通知管理
            </Link>
          )}
        </>
      }
    >
      {data === undefined ? null : <RiskWorkspace data={data} />}
    </ResourcePanel>
  );
}
