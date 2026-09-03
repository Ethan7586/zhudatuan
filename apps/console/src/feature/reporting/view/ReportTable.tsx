import { DataTable, type DataColumn } from '@shop/design';
import { chineseDomainLabel } from '@shop/presentation';
import { formatDate, formatMinor } from '../../../shared/ui/Format';
import type { ReportMetric } from '../model/Report';
import { reportMetricKey } from '../model/ReportingKey';
import { dimensionText } from './ReportingPresentation';

const ratio = new Intl.NumberFormat('zh-CN', { style: 'percent', maximumFractionDigits: 2 });
const columns: readonly DataColumn<ReportMetric>[] = Object.freeze([
  { key: 'code', label: '指标', render: (row) => chineseDomainLabel(row.code, '待识别指标') },
  { key: 'dimensions', label: '维度', render: (row) => dimensionText(row.dimensions) },
  { key: 'value', label: '服务端值', render: (row) => row.unit === 'minor' ? formatMinor(row.value) : row.unit === 'ratio' ? ratio.format(row.value) : new Intl.NumberFormat('zh-CN').format(row.value) },
  { key: 'period', label: '统计区间', render: (row) => `${formatDate(row.period.from)} – ${formatDate(row.period.to)}` },
  { key: 'watermark', label: '数据截至', render: (row) => formatDate(row.watermark) },
  { key: 'projection', label: '投影版本', render: (row) => `v${row.projectionVersion}` },
]);

export function ReportTable({ rows }: Readonly<{ rows: readonly ReportMetric[] }>) {
  return <DataTable caption="报表指标" columns={columns} rows={rows} rowKey={reportMetricKey} />;
}
