import { useQuery } from '@tanstack/react-query';
import { useSearchParams } from 'react-router';
import { useConsoleContext } from '../../entity/session/ConsoleContext';
import { queryCondition, safeQueryError } from '../../shared/presentation/QueryState';
import type { DataColumn } from '../../shared/ui/DataTable';
import { formatDate } from '../../shared/ui/Format';
import { PagedResource } from '../../shared/ui/PagedResource';
import { pageCursor } from '../../shared/url/PageCursor';
import { controlKey, readControl } from './ControlQuery';
import type { Distributor, Layer, RuntimeControl } from './ControlSchema';

const layerColumns: readonly DataColumn<Layer>[] = [
  { key: 'name', label: '组织', render: (row) => row.name },
  { key: 'kind', label: '层级', render: (row) => row.kind },
  { key: 'parent', label: '上级', render: (row) => row.parent_id ?? '—' },
  { key: 'timezone', label: '时区', render: (row) => row.timezone ?? '—' },
  { key: 'status', label: '状态', render: (row) => row.status },
  { key: 'version', label: '版本', render: (row) => row.version ?? '—' },
];
const distributorColumns: readonly DataColumn<Distributor>[] = [
  { key: 'name', label: '分销商', render: (row) => row.name },
  { key: 'code', label: '编码', render: (row) => row.code },
  { key: 'settlement', label: '结算模式', render: (row) => row.settlement_mode },
  { key: 'tenants', label: '租户数', render: (row) => row.tenant_count },
  { key: 'status', label: '状态', render: (row) => row.status },
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
  if (runtimeScope) {
    const rows = data?.kind === 'runtime' ? runtimeRows(data.health) : [];
    return (
      <PagedResource
        title="智慧翼中控台"
        eyebrow="SMART WING CONTROL"
        description="缓存、任务队列、数据库、合同与扩展状态来自 runtime.health.dependency。"
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
        eyebrow="SMART WING DISTRIBUTION"
        description="分销商、结算模式与租户绑定统计来自 channel.distributors.read。"
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
      eyebrow="SMART WING PLATFORM"
      description="平台组织层级与可见范围来自 organization.layers.read。"
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
      detail: `排队 ${health.queue.queued} · 运行 ${health.queue.running} · 死信 ${health.queue.deadletters} · 最老 ${health.queue.oldest_seconds}s`,
    },
    { id: 'cache', subsystem: '缓存', status: health.cache.available ? '可用' : '降级', detail: health.cache.reason ?? '连接与读写正常' },
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
      detail: `迁移 ${readiness.migration.head} · 合同 ${readiness.contract.checksum.slice(0, 12)}`,
    },
    {
      id: 'extensions',
      subsystem: '扩展',
      status: readiness.extensions.unhealthy === 0 ? '正常' : '需关注',
      detail: `注册 ${readiness.extensions.registered} · 健康 ${readiness.extensions.healthy} · 异常 ${readiness.extensions.unhealthy}`,
    },
  ]);
}
