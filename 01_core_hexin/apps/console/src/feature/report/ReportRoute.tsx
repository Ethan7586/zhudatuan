import { Button, ResourceState, WorkspaceHero } from '@shop/design';
import { useQuery } from '@tanstack/react-query';
import { useSearchParams } from 'react-router';
import { useConsoleContext } from '../../entity/session/ConsoleContext';
import { queryCondition, safeQueryError } from '../../shared/api/QueryState';
import { DataTable, type DataColumn } from '../../shared/ui/DataTable';
import { formatDate, formatMinor } from '../../shared/ui/Format';
import { pageCursor } from '../../shared/url/PageCursor';
import { BusinessPerspectiveBar } from '../supply-chain/BusinessPerspectiveBar';
import { readSupplierPerspectives, supplierPerspectiveKey } from '../supply-chain/SupplierPerspectiveQuery';
import { readReport, reportKey, reportPeriods, reportViews } from './ReportQuery';
import type { ReportMetric, ReportPeriod, ReportView } from './ReportSchema';
import './report.css';

const columns: readonly DataColumn<ReportMetric>[] = [
  { key: 'code', label: '经营指标', render: (row) => metricLabel(row) },
  { key: 'dimensions', label: '统计对象', render: (row) => dimensionLabel(row) },
  { key: 'value', label: '结果', render: (row) => row.unit === 'minor' ? formatMinor(row.value)
    : row.unit === 'ratio' ? ratioFormatter.format(row.value) : row.value },
  { key: 'period', label: '统计区间', render: (row) => `${row.period.from} – ${row.period.to}` },
  { key: 'watermark', label: '数据截至', render: (row) => formatDate(row.watermark) },
];

const ratioFormatter = new Intl.NumberFormat('zh-CN', { style: 'percent', maximumFractionDigits: 2 });

export function Component() {
  const context = useConsoleContext(); const [search, setSearch] = useSearchParams();
  const rawView = search.get('view'); const rawPeriod = search.get('period');
  const supplier = search.get('supplier') ?? undefined;
  const requestedView: ReportView = reportViews.includes(rawView as ReportView) ? rawView as ReportView : 'sales';
  const view: ReportView = supplier !== undefined && !supplierViewOptions.some(({ value }) => value === requestedView) ? 'sales' : requestedView;
  const period: ReportPeriod = reportPeriods.includes(rawPeriod as ReportPeriod) ? rawPeriod as ReportPeriod : '30days';
  const cursor = search.get('cursor') ?? undefined;
  const query = useQuery({ queryKey: reportKey(context, view, period, cursor, supplier),
    queryFn: ({ signal }) => readReport(context, view, period, cursor, signal, supplier) });
  const perspectives = useQuery({ queryKey: supplierPerspectiveKey(context),
    queryFn: ({ signal }) => readSupplierPerspectives(context, signal), enabled: query.data !== undefined,
    staleTime: 5 * 60_000 });
  const data = query.data; const error = safeQueryError(query.error);
  const condition = queryCondition({ pending: query.isPending, fetching: query.isFetching, error: query.error,
    hasData: data !== undefined, empty: data?.items.length === 0, stale: query.isStale });
  const setFilter = (key: 'view' | 'period', value: string) => { const next = new URLSearchParams(search); next.set(key, value); next.delete('cursor'); setSearch(next); };
  const selected = perspectives.data?.find(({ id }) => id === supplier);
  const setPerspective = (nextSupplier?: string) => { const next = new URLSearchParams(search); next.delete('cursor');
    if (nextSupplier === undefined) next.delete('supplier'); else next.set('supplier', nextSupplier);
    if (nextSupplier !== undefined && ['malls', 'powderclass', 'voucher'].includes(view)) next.set('view', 'sales');
    setSearch(next); };
  const viewOptions = supplier === undefined ? allViewOptions : supplierViewOptions;
  const activeView = viewOptions.find((option) => option.value === view)?.label ?? '销售';
  const title = selected === undefined ? '数据报表' : `${selected.name}数据报表`;
  return <section className="reportpage" aria-label={title}>
    <WorkspaceHero className="reporthero" title={title}
      description={selected === undefined ? '按商品、供应商、渠道和结算状态，看清每一笔生意。'
        : `只统计 ${selected.name} 在当前商城中的销售、履约与结算数据。`}
      actions={<Button onPress={() => { void query.refetch(); }}>{query.isFetching ? '正在刷新' : '刷新数据'}</Button>} />
    <BusinessPerspectiveBar partners={perspectives.data ?? []}
      {...(supplier === undefined ? {} : { selected: supplier })} busy={perspectives.isFetching || query.isFetching} onSelect={setPerspective} />
    <div className="reportworkspace">
      <aside className="reportdirectory" aria-label="报表目录">
        <header><div><h2>看什么</h2><p>{supplier === undefined ? '全部经营口径' : '供应商经营口径'}</p></div>
          <span>{viewOptions.length}</span></header>
        <nav>{viewOptions.map((option) => <button key={option.value} type="button" aria-current={view === option.value ? 'page' : undefined}
          onClick={() => setFilter('view', option.value)}><i aria-hidden="true" />{option.label}<span>›</span></button>)}</nav>
      </aside>
      <section className="reportresults" aria-labelledby="reportresulttitle">
        <header><div><h2 id="reportresulttitle">{activeView}</h2><p>{reportDescription(view, selected?.name)}</p></div>
          <span className={`reportdatasource reportdatasource-${condition}`}><i aria-hidden="true" />
            {query.isFetching ? '正在同步' : `${data?.count ?? 0} 条结果`}</span></header>
        <div className="reporttoolbar" role="group" aria-label="统计周期">
          <span>统计周期</span>{periodOptions.map((option) => <button key={option.value} type="button"
            aria-pressed={period === option.value} onClick={() => setFilter('period', option.value)}>{option.label}</button>)}
        </div>
        <ResourceState condition={condition} resourceLabel={title} {...(error === undefined ? {} : { error })}
          retry={() => { void query.refetch(); }}>
          <div className="reporttablearea">
            <DataTable caption={`${title} · ${activeView}`} columns={columns} rows={data?.items ?? []}
              rowKey={(row) => `${row.code}:${row.version}:${JSON.stringify(row.dimensions)}`} />
            <div className="reportpagination"><span>本页 {data?.count ?? 0} 条</span><Button
              onPress={() => { if (data?.nextCursor !== undefined) setSearch(pageCursor(search, data.nextCursor)); }}
              isDisabled={data?.nextCursor === undefined}>下一页</Button></div>
          </div>
        </ResourceState>
      </section>
    </div>
  </section>;
}

const periodOptions: readonly Readonly<{ value: ReportPeriod; label: string }>[] = [
  { value: 'realtime', label: '今天' }, { value: 'yesterday', label: '昨日' },
  { value: '7days', label: '近 7 日' }, { value: '30days', label: '近 30 日' },
];

const allViewOptions: readonly Readonly<{ value: ReportView; label: string }>[] = [
  { value: 'sales', label: '销售' }, { value: 'products', label: '商品' }, { value: 'malls', label: '商城' },
  { value: 'categories', label: '分类' }, { value: 'channels', label: '渠道' }, { value: 'powderclass', label: '粉类' },
  { value: 'voucher', label: '卡券消费' },
];
const supplierViewOptions: readonly Readonly<{ value: ReportView; label: string }>[] = [
  { value: 'sales', label: '供应成交' }, { value: 'products', label: '商品贡献' }, { value: 'categories', label: '品类结构' },
  { value: 'channels', label: '供应渠道' }, { value: 'fulfillment', label: '履约进度' }, { value: 'settlements', label: '结算状态' },
];

function metricLabel(row: ReportMetric): string {
  const labels: Record<string, string> = { 'sales.amount': '净供应成交额', 'sales.orders': '供应订单',
    'product.amount': '商品成交额', 'category.amount': '品类成交额', 'channel.amount': '渠道成交额',
    'fulfillment.orders': '履约订单', 'settlement.amount': '结算金额' };
  return labels[row.code] ?? row.code;
}

function dimensionLabel(row: ReportMetric): string {
  return row.dimensions.label ?? row.dimensions.productName ?? row.dimensions.categoryName
    ?? row.dimensions.channel ?? row.dimensions.supplierName ?? '全部经营';
}

function reportDescription(view: ReportView, supplier?: string): string {
  const prefix = supplier === undefined ? '' : `${supplier} · `;
  const descriptions: Record<ReportView, string> = {
    sales: '成交金额与支付订单', products: '每件商品带来的成交贡献', malls: '各商城的成交表现',
    categories: '不同商品类别的销售结构', channels: '不同供应渠道的成交表现', powderclass: '粉类商品经营结构',
    voucher: '卡券消费金额与核销次数', fulfillment: '待处理、履约中和已完成订单', settlements: '待确认、待付款和已结算金额',
  };
  return `${prefix}${descriptions[view]}`;
}
