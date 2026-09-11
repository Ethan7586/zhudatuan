import { useQuery } from '@tanstack/react-query';
import { useSearchParams } from 'react-router';
import { useConsoleContext } from '../../entity/session/ConsoleContext';
import { queryCondition, safeQueryError } from '../../shared/api/QueryState';
import type { DataColumn } from '../../shared/ui/DataTable';
import { formatDate, formatMinor } from '../../shared/ui/Format';
import { PagedResource } from '../../shared/ui/PagedResource';
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
  const perspectives = useQuery({ queryKey: supplierPerspectiveKey(context),
    queryFn: ({ signal }) => readSupplierPerspectives(context, signal), staleTime: 5 * 60_000 });
  const query = useQuery({ queryKey: reportKey(context, view, period, cursor, supplier),
    queryFn: ({ signal }) => readReport(context, view, period, cursor, signal, supplier) });
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
  return <section className="reportpage"><BusinessPerspectiveBar partners={perspectives.data ?? []}
    {...(supplier === undefined ? {} : { selected: supplier })} busy={perspectives.isFetching || query.isFetching} onSelect={setPerspective} />
    <PagedResource title={selected === undefined ? '数据报表' : `${selected.name}数据报表`} eyebrow="SMART WING REPORTING"
    description={selected === undefined ? '从统一经营口径查看销售、商品、商城、分类与渠道表现。'
      : `只统计 ${selected.name} 在当前商城中的真实商品、订单、履约与结算数据。`}
    condition={condition} {...(error === undefined ? {} : { error })} rows={data?.items ?? []} columns={columns} rowKey={(row) => `${row.code}:${row.version}:${JSON.stringify(row.dimensions)}`}
    count={data?.count ?? 0} {...(data?.nextCursor === undefined ? {} : { nextCursor: data.nextCursor })}
    actions={<><label className="inlinefield">报表<select value={view} onChange={(event) => setFilter('view', event.target.value)}>
      {viewOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label>
      <label className="inlinefield">周期<select value={period} onChange={(event) => setFilter('period', event.target.value)}>
        <option value="realtime">实时</option><option value="yesterday">昨日</option><option value="7days">近 7 日</option>
        <option value="30days">近 30 日</option></select></label></>}
    retry={() => { void query.refetch(); }} next={(next) => setSearch(pageCursor(search, next))} /></section>;
}

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
