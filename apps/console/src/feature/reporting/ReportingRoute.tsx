import { useQuery } from '@tanstack/react-query';
import { useSearchParams } from 'react-router';
import { useConsoleContext } from '../../entity/session/ConsoleContext';
import { queryCondition, safeQueryError } from '../../shared/presentation/QueryState';
import type { DataColumn } from '../../shared/ui/DataTable';
import { formatDate, formatMinor } from '../../shared/ui/Format';
import { PagedResource } from '../../shared/ui/PagedResource';
import { pageCursor } from '../../shared/url/PageCursor';
import { readReport, reportKey, reportPeriods, reportViews } from './ReportingQuery';
import type { ReportMetric, ReportPeriod, ReportView } from './ReportingSchema';
import { reportMetricKey } from './ReportingKey';

const columns: readonly DataColumn<ReportMetric>[] = [
  { key: 'code', label: '指标', render: (row) => row.code },
  {
    key: 'dimensions',
    label: '维度',
    render: (row) =>
      Object.entries(row.dimensions)
        .map(([key, value]) => `${key}: ${value}`)
        .join(' · ') || '全部',
  },
  { key: 'value', label: '服务端值', render: (row) => (row.unit === 'minor' ? formatMinor(row.value) : row.unit === 'ratio' ? ratioFormatter.format(row.value) : row.value) },
  { key: 'period', label: '统计区间', render: (row) => `${row.period.from} – ${row.period.to}` },
  { key: 'watermark', label: '数据截至', render: (row) => formatDate(row.watermark) },
  { key: 'projection', label: '投影版本', render: (row) => row.projectionVersion },
];

const ratioFormatter = new Intl.NumberFormat('zh-CN', { style: 'percent', maximumFractionDigits: 2 });

export function Component() {
  const context = useConsoleContext();
  const [search, setSearch] = useSearchParams();
  const rawView = search.get('view');
  const rawPeriod = search.get('period');
  const view: ReportView = reportViews.includes(rawView as ReportView) ? (rawView as ReportView) : 'sales';
  const period: ReportPeriod = reportPeriods.includes(rawPeriod as ReportPeriod) ? (rawPeriod as ReportPeriod) : '30days';
  const cursor = search.get('cursor') ?? undefined;
  const query = useQuery({ queryKey: reportKey(context, view, period, cursor), queryFn: ({ signal }) => readReport(context, view, period, cursor, signal) });
  const data = query.data;
  const error = safeQueryError(query.error);
  const condition = queryCondition({ pending: query.isPending, fetching: query.isFetching, error: query.error, hasData: data !== undefined, empty: data?.items.length === 0 });
  const setFilter = (key: 'view' | 'period', value: string) => {
    const next = new URLSearchParams(search);
    next.set(key, value);
    next.delete('cursor');
    setSearch(next);
  };
  return (
    <PagedResource
      title="数据报表"
      eyebrow="SMART WING REPORTING"
      description="指标、口径、范围、截至时间和投影版本全部由 reporting 读模型返回。"
      condition={condition}
      {...(error === undefined ? {} : { error })}
      rows={data?.items ?? []}
      columns={columns}
      rowKey={reportMetricKey}
      count={data?.count ?? 0}
      {...(data?.nextCursor === undefined ? {} : { nextCursor: data.nextCursor })}
      actions={
        <>
          <label className="inlinefield">
            报表
            <select value={view} onChange={(event) => setFilter('view', event.target.value)}>
              <option value="sales">销售</option>
              <option value="products">商品</option>
              <option value="malls">商城</option>
              <option value="categories">分类</option>
              <option value="channels">渠道</option>
              <option value="powderclass">粉类</option>
              <option value="voucher">卡券消费</option>
            </select>
          </label>
          <label className="inlinefield">
            周期
            <select value={period} onChange={(event) => setFilter('period', event.target.value)}>
              <option value="realtime">实时</option>
              <option value="yesterday">昨日</option>
              <option value="7days">近 7 日</option>
              <option value="30days">近 30 日</option>
            </select>
          </label>
        </>
      }
      boundary={{ title: '导出保持关闭', message: '冻结查询、Scope 证据、下载到期和 CSV 注入防护未完成前，不创建报表导出任务。' }}
      retry={() => {
        void query.refetch();
      }}
      next={(next) => setSearch(pageCursor(search, next))}
    />
  );
}
