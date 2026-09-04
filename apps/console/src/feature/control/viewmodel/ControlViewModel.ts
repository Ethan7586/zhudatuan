import { hasFailureCode, queryCondition, safeQueryError } from '@shop/presentation';
import { useQuery } from '@tanstack/react-query';
import { useCallback, useEffect, useMemo } from 'react';
import { useSearchParams } from 'react-router';
import type { ControlDependencies } from '../../../app/Dependencies';
import type { ConsoleContext } from '../../../entity/session/ConsoleSession';
import { controlKind, type Distributor, type PlatformLayer, type RuntimeHealth } from '../model/Control';
import { controlQueryKey } from './ControlQueryKey';

export interface RuntimeRow {
  readonly id: string;
  readonly subsystem: string;
  readonly status: string;
  readonly detail: string;
}
export type ControlContentViewModel =
  | Readonly<{ kind: 'platform'; rows: readonly PlatformLayer[]; count: number; nextCursor?: string }>
  | Readonly<{ kind: 'distribution'; rows: readonly Distributor[]; count: number; nextCursor?: string }>
  | Readonly<{ kind: 'runtime'; rows: readonly RuntimeRow[]; count: number }>;

const copy = Object.freeze({
  platform: { title: '平台层', eyebrow: '平台层', description: '平台组织层级与可见范围均来自权威组织服务。' },
  distribution: { title: '分销层', eyebrow: '分销层', description: '分销商、结算模式与租户绑定统计均来自权威渠道服务。' },
  runtime: { title: '智慧翼中控台', eyebrow: '系统运行状态', description: '缓存、任务队列、数据库、接口协议与扩展状态均来自权威运行服务。' },
});

export function useControlViewModel(context: ConsoleContext, dependencies: ControlDependencies, requestStepup: () => void) {
  const [search, setSearch] = useSearchParams();
  const kind = controlKind(context.scope.kind);
  const cursor = kind === 'runtime' ? undefined : (search.get('cursor') ?? undefined);
  useEffect(() => {
    if (kind !== 'runtime' || !search.has('cursor')) return;
    setSearch(
      (current) => {
        const next = new URLSearchParams(current);
        next.delete('cursor');
        return next;
      },
      { replace: true }
    );
  }, [kind, search, setSearch]);
  const query = useQuery({ queryKey: controlQueryKey(context, cursor), queryFn: ({ signal }) => dependencies.read.execute(context, cursor, signal) });
  const data = query.data;
  const content = useMemo(() => mapContent(data), [data]);
  const refetch = query.refetch;
  const refresh = useCallback(() => {
    void refetch();
  }, [refetch]);
  const next = useCallback(
    (nextCursor: string) =>
      setSearch((current) => {
        const nextSearch = new URLSearchParams(current);
        nextSearch.set('cursor', nextCursor);
        return nextSearch;
      }),
    [setSearch]
  );
  const first = useCallback(
    () =>
      setSearch((current) => {
        const nextSearch = new URLSearchParams(current);
        nextSearch.delete('cursor');
        return nextSearch;
      }),
    [setSearch]
  );
  const actions = useMemo(() => Object.freeze({ refresh, next, first, stepup: requestStepup }), [first, next, refresh, requestStepup]);
  const needsStepup = kind === 'runtime' && hasFailureCode(query.error, 'STEPUP_REQUIRED');
  return Object.freeze({
    ...copy[kind],
    kind,
    content,
    cursor,
    needsStepup,
    condition: queryCondition({ pending: query.isPending, fetching: query.isFetching, error: query.error, hasData: data !== undefined, empty: content?.count === 0 }),
    error: needsStepup ? undefined : safeQueryError(query.error),
    fetching: query.isFetching,
    actions,
  });
}

function mapContent(data: Awaited<ReturnType<ControlDependencies['read']['execute']>> | undefined): ControlContentViewModel | undefined {
  if (data === undefined) return undefined;
  if (data.kind === 'runtime') return Object.freeze({ kind: data.kind, rows: runtimeRows(data.health), count: 5 });
  if (data.kind === 'platform') return Object.freeze({ kind: data.kind, rows: data.page.items, count: data.page.count, ...(data.page.nextCursor === undefined ? {} : { nextCursor: data.page.nextCursor }) });
  return Object.freeze({ kind: data.kind, rows: data.page.items, count: data.page.count, ...(data.page.nextCursor === undefined ? {} : { nextCursor: data.page.nextCursor }) });
}

function runtimeRows(health: RuntimeHealth): readonly RuntimeRow[] {
  const readiness = health.readiness;
  return Object.freeze([
    {
      id: 'queue',
      subsystem: '任务队列',
      status: health.queue.deadletters === 0 ? '正常' : '需关注',
      detail: `排队 ${health.queue.queued} · 运行 ${health.queue.running} · 异常任务 ${health.queue.deadletters} · 最久等待 ${health.queue.oldestSeconds} 秒`,
    },
    { id: 'cache', subsystem: '缓存', status: health.cache.available ? '可用' : '降级', detail: health.cache.reason ? '连接异常，请检查服务状态' : '连接与读写正常' },
    {
      id: 'database',
      subsystem: '数据库',
      status: readiness.database.writable && readiness.database.contract && readiness.database.migration && readiness.database.role ? '正常' : '需关注',
      detail: `操作 ${readiness.database.operations} · 能力 ${readiness.database.capabilities} · 事件 ${readiness.database.events}`,
    },
    {
      id: 'contract',
      subsystem: '合同与迁移',
      status: readiness.contract.matches && readiness.configuration.matches && readiness.migration.matches ? '一致' : '漂移',
      detail: readiness.contract.matches && readiness.configuration.matches && readiness.migration.matches ? '数据库迁移、运行配置与接口协议一致' : '数据库迁移、运行配置或接口协议需要复核',
    },
    {
      id: 'extensions',
      subsystem: '扩展',
      status: readiness.extensions.unhealthy === 0 ? '正常' : '需关注',
      detail: `注册 ${readiness.extensions.registered} · 健康 ${readiness.extensions.healthy} · 异常 ${readiness.extensions.unhealthy}`,
    },
  ]);
}

export type ControlViewModel = ReturnType<typeof useControlViewModel>;
