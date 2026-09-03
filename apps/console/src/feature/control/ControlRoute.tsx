import { chineseDomainLabel, chineseReference, chineseSectionLabel, hasFailureCode, queryCondition, safeQueryError } from '@shop/presentation';
import { useQuery } from '@tanstack/react-query';
import { useSearchParams } from 'react-router';
import { AssurancePrompt } from '../../entity/session/AssurancePrompt';
import { useConsoleContext } from '../../entity/session/ConsoleContext';

import type { DataColumn } from '../../shared/ui/DataTable';
import { formatDate } from '../../shared/ui/Format';
import { PagedResource } from '../../shared/ui/PagedResource';
import { pageCursor } from '../../shared/url/PageCursor';
import { controlKey, readControl } from './ControlQuery';
import type { Distributor, Layer, RuntimeControl } from './ControlSchema';

const layerColumns: readonly DataColumn<Layer>[] = [
  { key: 'name', label: '组织', render: (row) => row.name },
  { key: 'kind', label: '层级', render: (row) => chineseDomainLabel(row.kind) },
  { key: 'parent', label: '上级', render: (row) => chineseReference('上级组织', row.parent_id) },
  { key: 'timezone', label: '时区', render: (row) => chineseDomainLabel(row.timezone, '其他时区') },
  { key: 'status', label: '状态', render: (row) => chineseDomainLabel(row.status) },
  { key: 'version', label: '版本', render: (row) => row.version ?? '—' },
];
const distributorColumns: readonly DataColumn<Distributor>[] = [
  { key: 'name', label: '分销商', render: (row) => row.name },
  { key: 'code', label: '编码', render: (row) => chineseReference('分销编码', row.code) },
  { key: 'settlement', label: '结算模式', render: (row) => chineseDomainLabel(row.settlement_mode) },
  { key: 'tenants', label: '租户数', render: (row) => row.tenant_count },
  { key: 'status', label: '状态', render: (row) => chineseDomainLabel(row.status) },
  { key: 'updated', label: '更新时间', render: (row) => formatDate(row.updated_at) },
];

interface RuntimeRow {
  readonly id: string;
  readonly subsystem: string;
  readonly status: string;
  readonly detail: string;
}
const runtimeColumns: readonly DataColumn<RuntimeRow>[] = [
  { key: 'subsystem', label: '子系统', render: (row) => row.subsystem },
  { key: 'status', label: '状态', render: (row) => row.status },
  { key: 'detail', label: '权威读数', render: (row) => row.detail },
];

export function Component() {
  const context = useConsoleContext();
  const [search, setSearch] = useSearchParams();
  const cursor = search.get('cursor') ?? undefined;
  const query = useQuery({ queryKey: controlKey(context, cursor), queryFn: ({ signal }) => readControl(context, cursor, signal) });
  const data = query.data;
  const error = safeQueryError(query.error);
  const condition = queryCondition({ pending: query.isPending, fetching: query.isFetching, error: query.error, hasData: data !== undefined, empty: data?.kind === 'runtime' ? false : data?.page.items.length === 0 });
  const runtimeScope = context.scope.kind !== 'platform' && context.scope.kind !== 'distributor';
  if (runtimeScope && hasFailureCode(query.error, 'STEPUP_REQUIRED')) {
    return <AssurancePrompt title="智慧翼中控台" description="运行状态包含数据库、任务队列与扩展健康信息。请完成短信二次验证后查看，成功后会自动返回当前数据范围。" />;
  }
  if (runtimeScope) {
    const rows = data?.kind === 'runtime' ? runtimeRows(data.health) : [];
    return (
      <PagedResource
        title="智慧翼中控台"
        eyebrow={chineseSectionLabel('系统运行状态')}
        description="缓存、任务队列、数据库、接口协议与扩展状态均来自权威运行服务。"
        condition={condition}
        {...(error === undefined ? {} : { error })}
        rows={rows}
        columns={runtimeColumns}
        rowKey={(row) => row.id}
        count={rows.length}
        retry={() => {
          void query.refetch();
        }}
        next={() => undefined}
      />
    );
  }
  if (data?.kind === 'distributor') {
    return (
      <PagedResource
        title="分销层"
        eyebrow={chineseSectionLabel('分销层')}
        description="分销商、结算模式与租户绑定统计均来自权威渠道服务。"
        condition={condition}
        {...(error === undefined ? {} : { error })}
        rows={data.page.items}
        columns={distributorColumns}
        rowKey={(row) => row.id}
        count={data.page.count}
        {...(data.page.nextCursor === undefined ? {} : { nextCursor: data.page.nextCursor })}
        retry={() => {
          void query.refetch();
        }}
        next={(next) => setSearch(pageCursor(search, next))}
      />
    );
  }
  const page = data?.kind === 'platform' ? data.page : undefined;
  return (
    <PagedResource
      title="平台层"
      eyebrow={chineseSectionLabel('平台层')}
      description="平台组织层级与可见范围均来自权威组织服务。"
      condition={condition}
      {...(error === undefined ? {} : { error })}
      rows={page?.items ?? []}
      columns={layerColumns}
      rowKey={(row) => row.id}
      count={page?.count ?? 0}
      {...(page?.nextCursor === undefined ? {} : { nextCursor: page.nextCursor })}
      retry={() => {
        void query.refetch();
      }}
      next={(next) => setSearch(pageCursor(search, next))}
    />
  );
}

function runtimeRows(health: RuntimeControl): readonly RuntimeRow[] {
  const readiness = health.readiness;
  return Object.freeze([
    {
      id: 'queue',
      subsystem: '任务队列',
      status: health.queue.deadletters === 0 ? '正常' : '需关注',
      detail: `排队 ${health.queue.queued} · 运行 ${health.queue.running} · 异常任务 ${health.queue.deadletters} · 最久等待 ${health.queue.oldest_seconds} 秒`,
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
