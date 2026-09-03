import { chineseDomainLabel, chineseReference, chineseSectionLabel, queryCondition, safeQueryError } from '@shop/presentation';
import { ResourcePanel } from '@shop/design';
import { createFetchOrganizationDirectoriesRead, createFetchOrganizationDirectoriesSync, createFetchOrganizationDirectoriesSyncrunsRead } from '@shop/sdk/organization';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { z } from 'zod';
import { useConsoleContext } from '../../../entity/session/ConsoleContext';
import { consoleCommand, consoleRequest } from '../../../shared/api/Client';

import { appConfig } from '../../../shared/config/AppConfig';
import { useRouteTitle } from '../../../shared/ui/RouteTitle';

const read = createFetchOrganizationDirectoriesRead(appConfig.apiBaseUrl);
const runs = createFetchOrganizationDirectoriesSyncrunsRead(appConfig.apiBaseUrl);
const sync = createFetchOrganizationDirectoriesSync(appConfig.apiBaseUrl);
const DirectoryPage = z.object({
  items: z.array(
    z.object({
      id: z.string(),
      organization_id: z.string(),
      type: z.enum(['wecomcorp', 'wecomsuite']),
      status: z.enum(['draft', 'enabled', 'paused', 'disabled', 'revoked']),
      successful_version: z.coerce.number(),
      version: z.coerce.number(),
      updated_at: z.string(),
      last_success_at: z.string().nullable(),
    })
  ),
  count: z.coerce.number(),
  nextCursor: z.string().optional(),
});
const RunPage = z.object({
  items: z.array(
    z.object({
      id: z.string(),
      mode: z.enum(['full', 'incremental', 'event', 'reconcile']),
      state: z.enum(['queued', 'running', 'completed', 'failed', 'cancelled']),
      read_count: z.coerce.number(),
      applied_count: z.coerce.number(),
      conflict_count: z.coerce.number(),
      ignored_count: z.coerce.number(),
    })
  ),
  count: z.coerce.number(),
  nextCursor: z.string().optional(),
});
const SyncResult = z.object({ id: z.string(), state: z.enum(['queued', 'running', 'completed', 'failed', 'cancelled']), mode: z.enum(['full', 'incremental']) });
export function Component() {
  const context = useConsoleContext();
  const title = useRouteTitle('通讯录同步');
  const client = useQueryClient();
  const [selected, setSelected] = useState<string>();
  const key = ['console', context.scope.id, context.session.accessVersion, 'organization.directories.read'] as const;
  const query = useQuery({ queryKey: key, queryFn: async ({ signal }) => DirectoryPage.parse(await read({ query: { limit: 50 } }, consoleRequest(context.scope, signal, context.session.accessVersion))) });
  const selectedId = selected ?? query.data?.items[0]?.id;
  const history = useQuery({
    queryKey: [...key, selectedId, 'runs'],
    enabled: selectedId !== undefined,
    queryFn: async ({ signal }) => RunPage.parse(await runs({ path: { directoryid: selectedId! }, query: { limit: 20 } }, consoleRequest(context.scope, signal, context.session.accessVersion))),
  });
  const start = useMutation({
    mutationFn: async (id: string) =>
      SyncResult.parse(
        await sync(
          { path: { directoryid: id }, body: { mode: 'incremental' } },
          consoleCommand(context.scope, {
            accessVersion: context.session.accessVersion,
            ...(context.session.csrf === undefined ? {} : { csrfToken: context.session.csrf }),
          })
        )
      ),
    onSuccess: async () => {
      await client.invalidateQueries({ queryKey: key });
    },
  });
  const error = safeQueryError(query.error);
  const condition = queryCondition({ pending: query.isPending, fetching: query.isFetching, error: query.error, hasData: query.data !== undefined, empty: query.data?.items.length === 0 });
  return (
    <ResourcePanel
      eyebrow={chineseSectionLabel('通讯录同步')}
      title={title}
      description="同步请求只进入队列，长任务由后台工作进程执行；重复事件由事件收件箱自动去重。"
      condition={condition}
      {...(error === undefined ? {} : { error })}
      retry={() => void query.refetch()}
    >
      <div className="featurestack">
        {query.data?.items.map((item) => (
          <article key={item.id}>
            <h2>{item.type === 'wecomcorp' ? '企业微信自建应用' : '企业微信第三方应用'}</h2>
            <p>
              状态：{chineseDomainLabel(item.status)} · 成功版本：第 {item.successful_version} 版
            </p>
            <button type="button" onClick={() => setSelected(item.id)}>
              查看运行
            </button>
            <button type="button" disabled={start.isPending || item.status !== 'enabled'} onClick={() => start.mutate(item.id)}>
              增量同步
            </button>
          </article>
        ))}
      </div>
      {selectedId && history.data ? (
        <section className="featurestack">
          <h2>最近同步运行</h2>
          {history.data.items.map((run) => (
            <p key={run.id}>
              {chineseDomainLabel(run.mode)} · {chineseDomainLabel(run.state)} · 应用 {run.applied_count} · 冲突 {run.conflict_count}
            </p>
          ))}
        </section>
      ) : null}
      {start.isSuccess ? <p role="status">同步任务已排队：{chineseReference('任务', start.data.id)}</p> : null}
      {start.isError ? <p role="alert">{safeQueryError(start.error) ?? '目录同步暂时无法启动，请稍后重试。'}</p> : null}
    </ResourcePanel>
  );
}
