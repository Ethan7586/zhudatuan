import { queryCondition, safeQueryError } from '@shop/presentation';
import { ResourcePanel } from '@shop/design';
import { createFetchIdentityProvidersRead, createFetchIdentityProvidersTest } from '@shop/sdk/identity';
import { useMutation, useQuery } from '@tanstack/react-query';
import { useConsoleContext } from '../../../entity/session/ConsoleContext';
import { consoleCommand, consoleRequest } from '../../../shared/api/Client';

import { appConfig } from '../../../shared/config/AppConfig';
import { useRouteTitle } from '../../../shared/ui/RouteTitle';

const read = createFetchIdentityProvidersRead(appConfig.apiBaseUrl);
const test = createFetchIdentityProvidersTest(appConfig.apiBaseUrl);
export function Component() {
  const context = useConsoleContext();
  const title = useRouteTitle('登录方式');
  const query = useQuery({
    queryKey: ['console', context.scope.id, context.session.accessVersion, 'identity.providers.read'],
    queryFn: ({ signal }) => read({ query: {} }, consoleRequest(context.scope, signal, context.session.accessVersion)),
  });
  const verify = useMutation({
    mutationFn: (id: string) =>
      test(
        { path: { providerid: id }, body: {} },
        consoleCommand(context.scope, {
          accessVersion: context.session.accessVersion,
          ...(context.session.csrf === undefined ? {} : { csrfToken: context.session.csrf }),
        })
      ),
  });
  const error = safeQueryError(query.error);
  const condition = queryCondition({ pending: query.isPending, fetching: query.isFetching, error: query.error, hasData: query.data !== undefined, empty: query.data?.items.length === 0 });
  return (
    <ResourcePanel
      eyebrow="IDENTITY PROVIDER"
      title={title}
      description="这里只显示服务端启用并允许当前租户使用的登录连接；Secret 永不回显。"
      condition={condition}
      {...(error === undefined ? {} : { error })}
      retry={() => void query.refetch()}
    >
      <div className="featurestack">
        {query.data?.items.map((item) => (
          <article key={item.id}>
            <h2>{providerName(item.type)}</h2>
            <p>状态：{item.status}</p>
            <button type="button" disabled={verify.isPending} onClick={() => verify.mutate(item.id)}>
              健康检查
            </button>
          </article>
        ))}
      </div>
      {verify.isSuccess ? <p role="status">健康检查：{verify.data.status}</p> : null}
      {verify.isError ? <p role="alert">{safeQueryError(verify.error) ?? '服务连接验证失败，请检查配置后重试。'}</p> : null}
    </ResourcePanel>
  );
}
function providerName(type: 'wechat' | 'wecomcorp' | 'wecomsuite' | 'oidc'): string {
  return ({ wechat: '微信', wecomcorp: '企业微信自建应用', wecomsuite: '企业微信第三方应用', oidc: 'OIDC' } as const)[type];
}
