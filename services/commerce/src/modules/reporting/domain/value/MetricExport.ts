import type { DisplayedMetric } from './DimensionCatalog';
import { semanticDimensionValue } from './DimensionCatalog';

export const METRIC_EXPORT_COLUMNS = Object.freeze(['指标', '统计维度', '指标值', '单位', '币种', '统计开始', '统计结束', '时区', '数据截至', '指标版本', '投影版本', '计算口径', '数据粒度', '报表生成时间']);

const formatters = new Map<string, Intl.DateTimeFormat>();

export function metricExportCells(metric: DisplayedMetric, generatedAt: string): readonly unknown[] {
  return Object.freeze([
    metric.definition.name,
    dimensionText(metric),
    metricValue(metric.value, metric.unit),
    unitName(metric.unit),
    currencyName(metric.currency),
    localTime(metric.period.from, metric.period.timezone),
    localTime(metric.period.to, metric.period.timezone),
    timezoneName(metric.period.timezone),
    localTime(metric.watermark, metric.period.timezone),
    `v${metric.version}`,
    `v${metric.projectionVersion}`,
    metric.definition.formula,
    metric.definition.granularity === 'day' ? '按日' : metric.definition.granularity,
    localTime(generatedAt, metric.period.timezone),
  ]);
}

function dimensionText(metric: DisplayedMetric): string {
  return metric.displayedDimensions.length > 0 ? metric.displayedDimensions.map(({ name, value }) => `${name}：${value}`).join('；') : '全部';
}

function metricValue(value: number, unit: DisplayedMetric['unit']): string | number {
  if (!Number.isFinite(value)) throw new Error('REPORT_EXPORT_VALUE_INVALID');
  if (unit === 'minor') {
    if (!Number.isSafeInteger(value)) throw new Error('REPORT_EXPORT_VALUE_INVALID');
    const absolute = Math.abs(value);
    return `${value < 0 ? '-' : ''}${Math.trunc(absolute / 100)}.${String(absolute % 100).padStart(2, '0')}`;
  }
  if (unit === 'ratio') return `${trimmed(value * 100, 4)}%`;
  return value;
}

function unitName(unit: DisplayedMetric['unit']): string {
  if (unit === 'minor') return '元';
  if (unit === 'ratio') return '百分比';
  return '数量';
}

function currencyName(currency: string | null): string {
  if (currency === null) return '不适用';
  const code = currency.toUpperCase();
  const name = semanticDimensionValue('currency', code);
  return name ? `${name}（${code}）` : code;
}

function timezoneName(timezone: string): string {
  return timezone === 'Asia/Shanghai' ? '中国标准时间（Asia/Shanghai）' : timezone;
}

function localTime(value: string, timezone: string): string {
  const instant = new Date(value);
  if (Number.isNaN(instant.getTime())) throw new Error('REPORT_TIME_INVALID');
  let formatter = formatters.get(timezone);
  if (!formatter) {
    formatter = new Intl.DateTimeFormat('zh-CN', {
      timeZone: timezone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hourCycle: 'h23',
    });
    formatters.set(timezone, formatter);
  }
  const parts = Object.fromEntries(formatter.formatToParts(instant).map(({ type, value: part }) => [type, part]));
  return `${parts.year}-${parts.month}-${parts.day} ${parts.hour}:${parts.minute}:${parts.second}`;
}

function trimmed(value: number, precision: number): string {
  return value
    .toFixed(precision)
    .replace(/\.0+$/u, '')
    .replace(/(\.\d*?)0+$/u, '$1');
}
