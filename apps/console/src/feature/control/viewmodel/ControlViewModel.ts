import { hasFailureCode, queryCondition, safeQueryError } from '@shop/presentation';
import { useQuery } from '@tanstack/react-query';
import { useCallback, useEffect, useMemo } from 'react';
import { useSearchParams } from 'react-router';
import type { ControlDependencies } from '../../../app/Dependencies';
import type { ConsoleContext } from '../../../entity/session/ConsoleSession';
import { controlKind, type Distributor, type PlatformLayer, type RuntimeControl } from '../model/Control';
import { controlQueryKey } from './ControlQueryKey';

export interface RuntimeRow {
  readonly id: string;
  readonly source: string;
  readonly subsystem: string;
  readonly status: string;
  readonly detail: string;
  readonly healthy: boolean;
}
export interface RuntimeMetric {
  readonly label: string;
  readonly value: string;
  readonly detail: string;
  readonly healthy: boolean;
}
export type ControlContentViewModel =
  | Readonly<{ kind: 'platform'; rows: readonly PlatformLayer[]; count: number; nextCursor?: string }>
  | Readonly<{ kind: 'distribution'; rows: readonly Distributor[]; count: number; nextCursor?: string }>
  | Readonly<{ kind: 'runtime'; rows: readonly RuntimeRow[]; metrics: readonly RuntimeMetric[]; observedAt: string; count: number }>;

const copy = Object.freeze({
  platform: { title: '平台层', eyebrow: '平台层', description: '平台组织层级与可见范围均来自权威组织服务。' },
  distribution: { title: '分销层', eyebrow: '分销层', description: '分销商、结算模式与租户绑定统计均来自权威渠道服务。' },
  runtime: { title: '智慧翼中控台', eyebrow: '系统运行状态', description: '能力、扩展、风险、服务目标和基础运行状态均来自各自权威服务。' },
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
  if (data.kind === 'runtime') {
    const rows = runtimeRows(data.health);
    return Object.freeze({ kind: data.kind, rows, metrics: runtimeMetrics(data.health), observedAt: data.health.observability.generatedAt, count: rows.length });
  }
  if (data.kind === 'platform') return Object.freeze({ kind: data.kind, rows: data.page.items, count: data.page.count, ...(data.page.nextCursor === undefined ? {} : { nextCursor: data.page.nextCursor }) });
  return Object.freeze({ kind: data.kind, rows: data.page.items, count: data.page.count, ...(data.page.nextCursor === undefined ? {} : { nextCursor: data.page.nextCursor }) });
}

function runtimeRows(health: RuntimeControl): readonly RuntimeRow[] {
  const readiness = health.runtime.readiness;
  const capabilityHealthy = health.capabilities.dependencyIssues === 0;
  const extensionHealthy = health.extensions.degraded + health.extensions.unavailable === 0;
  const riskHealthy = health.risk.openCases === 0;
  const observationHealthy = health.observability.condition === 'healthy';
  const serviceLevelHealthy = health.serviceLevels.atRisk + health.serviceLevels.breaching === 0;
  return Object.freeze([
    {
      id: 'queue',
      source: '运行基础',
      subsystem: '任务队列',
      status: health.runtime.queue.deadletters === 0 ? '正常' : '需关注',
      detail: `排队 ${health.runtime.queue.queued} · 运行 ${health.runtime.queue.running} · 异常任务 ${health.runtime.queue.deadletters} · 最久等待 ${health.runtime.queue.oldestSeconds} 秒`,
      healthy: health.runtime.queue.deadletters === 0,
    },
    { id: 'cache', source: '运行基础', subsystem: '缓存', status: health.runtime.cache.available ? '可用' : '降级', detail: health.runtime.cache.reason ? '连接异常，请检查服务状态' : '连接与读写正常', healthy: health.runtime.cache.available },
    {
      id: 'database',
      source: '运行基础',
      subsystem: '数据库',
      status: readiness.database.writable && readiness.database.contract && readiness.database.migration && readiness.database.role ? '正常' : '需关注',
      detail: `操作 ${readiness.database.operations} · 能力 ${readiness.database.capabilities} · 事件 ${readiness.database.events}`,
      healthy: readiness.database.writable && readiness.database.contract && readiness.database.migration && readiness.database.role,
    },
    {
      id: 'contract',
      source: '运行基础',
      subsystem: '合同与迁移',
      status: readiness.contract.matches && readiness.configuration.matches && readiness.migration.matches ? '一致' : '漂移',
      detail: readiness.contract.matches && readiness.configuration.matches && readiness.migration.matches ? '数据库迁移、运行配置与接口协议一致' : '数据库迁移、运行配置或接口协议需要复核',
      healthy: readiness.contract.matches && readiness.configuration.matches && readiness.migration.matches,
    },
    {
      id: 'capabilities', source: '能力', subsystem: '能力分配', status: capabilityHealthy ? '正常' : '依赖异常',
      detail: `共 ${health.capabilities.count} 项 · 启用 ${health.capabilities.enabled} · 停用 ${health.capabilities.disabled} · 依赖异常 ${health.capabilities.dependencyIssues}`, healthy: capabilityHealthy,
    },
    { id: 'extensions', source: '扩展', subsystem: '扩展安装', status: extensionHealthy ? '正常' : '需关注', detail: `安装 ${health.extensions.count} · 启用 ${health.extensions.enabled} · 健康 ${health.extensions.healthy} · 降级 ${health.extensions.degraded} · 不可用 ${health.extensions.unavailable}`, healthy: extensionHealthy },
    { id: 'risk', source: '风险', subsystem: '风险治理', status: riskHealthy ? '无待处理' : '待复核', detail: `策略 ${health.risk.policies} · 生效 ${health.risk.activePolicies} · 风险事项 ${health.risk.cases} · 待复核 ${health.risk.openCases}`, healthy: riskHealthy },
    { id: 'observability', source: '可观测性', subsystem: '运行观测', status: observationHealthy ? '正常' : '降级', detail: `依赖异常 ${health.observability.unhealthyDependencies} · 队列积压 ${health.observability.backloggedQueues} · 供应商扩展降级 ${health.observability.degradedProviders} · 发布 ${health.observability.release}`, healthy: observationHealthy },
    { id: 'servicelevels', source: '可观测性', subsystem: '服务目标', status: serviceLevelHealthy ? '达标' : '需关注', detail: `健康 ${health.serviceLevels.healthy} · 风险 ${health.serviceLevels.atRisk} · 违约 ${health.serviceLevels.breaching} · 无数据 ${health.serviceLevels.noData}`, healthy: serviceLevelHealthy },
  ]);
}

function runtimeMetrics(health: RuntimeControl): readonly RuntimeMetric[] {
  return Object.freeze([
    { label: '启用能力', value: `${health.capabilities.enabled}/${health.capabilities.count}`, detail: `依赖异常 ${health.capabilities.dependencyIssues}`, healthy: health.capabilities.dependencyIssues === 0 },
    { label: '健康扩展', value: `${health.extensions.healthy}/${health.extensions.count}`, detail: `降级或不可用 ${health.extensions.degraded + health.extensions.unavailable}`, healthy: health.extensions.degraded + health.extensions.unavailable === 0 },
    { label: '风险待办', value: `${health.risk.openCases}`, detail: `生效策略 ${health.risk.activePolicies}`, healthy: health.risk.openCases === 0 },
    { label: '服务目标', value: `${health.serviceLevels.healthy}/${health.serviceLevels.count}`, detail: `风险或违约 ${health.serviceLevels.atRisk + health.serviceLevels.breaching}`, healthy: health.serviceLevels.atRisk + health.serviceLevels.breaching === 0 },
  ]);
}

export type ControlViewModel = ReturnType<typeof useControlViewModel>;
