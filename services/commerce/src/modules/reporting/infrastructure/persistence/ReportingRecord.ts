import type { ExportFilterValue, ExportJob, ExportReport, ExportSnapshot, MetricExportRow } from '../../domain/model/ExportJob';
import type { CockpitProduct, CockpitSummary, Metric, MetricRow } from '../../domain/model/Metric';
import { dimensionNames, dimensionRecord, timezoneName } from '../../domain/value/Dimension';

type DatabaseTime = string | Date;

export interface MetricRecord {
  readonly code: string;
  readonly version: number;
  readonly definition: {
    readonly name: string;
    readonly formula: string;
    readonly dimensions: readonly string[];
    readonly granularity: 'day';
    readonly owner: 'reporting';
  };
  readonly scope: string;
  readonly period: { from: DatabaseTime; to: DatabaseTime; timezone: string };
  readonly dimensions: Record<string, string>;
  readonly value: number;
  readonly unit: Metric['unit'];
  readonly currency: string | null;
  readonly watermark: DatabaseTime;
  readonly projectionVersion: number;
  readonly cursorTime: DatabaseTime;
  readonly cursorId: string;
}

export interface ExportRecord {
  readonly id: string;
  readonly scope: string;
  readonly report: ExportReport;
  readonly filter: Record<string, ExportFilterValue>;
  readonly snapshot: ExportSnapshot;
  readonly state: ExportJob['state'];
  readonly cursor: string | null;
  readonly recordCount: number;
  readonly objectReference: string | null;
  readonly objectHash: string | null;
  readonly objectSize: number | null;
  readonly scanState: ExportJob['scanState'];
  readonly expiresAt: DatabaseTime | null;
  readonly createdAt: DatabaseTime;
  readonly generatedAt: DatabaseTime | null;
}

export interface MetricExportRecord {
  readonly key: string;
  readonly values: unknown;
}

export function exportSelect(): string {
  return `select job.id,job.scope_id scope,job.report,job.filter,case when job.state='completed' and job.expires_at<=clock_timestamp()
    then 'expired' else job.state end state,job.cursor,job.record_count "recordCount",job.object_ref "objectReference",job.sha256 "objectHash",
    job.object_size "objectSize",job.scan_state "scanState",job.expires_at "expiresAt",job.created_at "createdAt",job.generated_at "generatedAt",
    jsonb_build_object('filter',job.query_snapshot,'watermark',jsonb_build_object('event',job.watermark_event,
      'occurredAt',job.watermark_at,'version',job.watermark_version),'generatedAt',job.snapshot_at,'generationVersion',job.generation_version) snapshot
    from reporting.export job`;
}

export function exportJob(row: ExportRecord): ExportJob {
  return Object.freeze({
    ...row,
    filter: Object.freeze({ ...row.filter }),
    snapshot: Object.freeze({
      ...row.snapshot,
      filter: Object.freeze({ ...row.snapshot.filter }),
      watermark: Object.freeze({ ...row.snapshot.watermark, occurredAt: utcTime(row.snapshot.watermark.occurredAt) }),
      generatedAt: utcTime(row.snapshot.generatedAt),
    }),
    expiresAt: optionalTime(row.expiresAt),
    createdAt: utcTime(row.createdAt),
    generatedAt: optionalTime(row.generatedAt),
  });
}

export function metricRow(row: MetricRecord): MetricRow {
  return Object.freeze({
    ...row,
    definition: Object.freeze({ ...row.definition, dimensions: dimensionNames(row.definition.dimensions) }),
    period: Object.freeze({ from: utcTime(row.period.from), to: utcTime(row.period.to), timezone: timezoneName(row.period.timezone) }),
    dimensions: dimensionRecord(row.dimensions),
    watermark: utcTime(row.watermark),
    cursorTime: utcTime(row.cursorTime),
  });
}

export function metricExportRow(row: MetricExportRecord): MetricExportRow {
  const values = array(row.values, 19, 'REPORT_EXPORT_ROW_INVALID');
  const key = exportText(row.key, 'REPORT_EXPORT_CURSOR_INVALID');
  const dimensions = record(values[11], 'REPORT_EXPORT_DIMENSIONS_INVALID');
  const metric = metricRow({
    code: exportText(values[0], 'REPORT_EXPORT_METRIC_INVALID'),
    version: positiveInteger(values[1], 'REPORT_EXPORT_METRIC_VERSION_INVALID'),
    definition: {
      name: exportText(values[2], 'REPORT_EXPORT_METRIC_NAME_INVALID'),
      formula: exportText(values[3], 'REPORT_EXPORT_FORMULA_INVALID'),
      dimensions: stringArray(values[4], 'REPORT_EXPORT_DEFINITIONS_INVALID'),
      granularity: literal(values[5], ['day'] as const, 'REPORT_EXPORT_GRANULARITY_INVALID'),
      owner: literal(values[6], ['reporting'] as const, 'REPORT_EXPORT_OWNER_INVALID'),
    },
    scope: exportText(values[7], 'REPORT_EXPORT_SCOPE_INVALID'),
    period: {
      from: time(values[8], 'REPORT_EXPORT_PERIOD_INVALID'),
      to: time(values[9], 'REPORT_EXPORT_PERIOD_INVALID'),
      timezone: exportText(values[10], 'REPORT_EXPORT_TIMEZONE_INVALID'),
    },
    dimensions: Object.fromEntries(Object.entries(dimensions).map(([name, value]) => [name, exportText(value, 'REPORT_EXPORT_DIMENSION_INVALID')])),
    value: finiteNumber(values[12], 'REPORT_EXPORT_VALUE_INVALID'),
    unit: literal(values[13], ['minor', 'count', 'ratio'] as const, 'REPORT_EXPORT_UNIT_INVALID'),
    currency: nullableText(values[14], 'REPORT_EXPORT_CURRENCY_INVALID'),
    watermark: time(values[15], 'REPORT_EXPORT_WATERMARK_INVALID'),
    projectionVersion: positiveInteger(values[16], 'REPORT_EXPORT_PROJECTION_VERSION_INVALID'),
    cursorTime: time(values[9], 'REPORT_EXPORT_PERIOD_INVALID'),
    cursorId: key,
  });
  return Object.freeze({ key, metric, generatedAt: utcTime(time(values[18], 'REPORT_EXPORT_GENERATED_AT_INVALID')) });
}

export function cockpitSummary(summary: CockpitSummary, products: readonly CockpitProduct[] = summary.sales.topProducts): CockpitSummary {
  return Object.freeze({
    ...summary,
    sales: Object.freeze({
      ...summary.sales,
      asOf: utcTime(summary.sales.asOf),
      period: Object.freeze({ from: utcTime(summary.sales.period.from), to: utcTime(summary.sales.period.to) }),
      deltas: Object.freeze({ ...summary.sales.deltas }),
      trend: Object.freeze(summary.sales.trend.map((row) => Object.freeze({ ...row }))),
      weeklyTrend: Object.freeze(summary.sales.weeklyTrend.map((row) => Object.freeze({ ...row }))),
      categories: Object.freeze(summary.sales.categories.map((row) => Object.freeze({ ...row }))),
      topProducts: Object.freeze(products.map((row) => Object.freeze({ ...row }))),
      malls: Object.freeze(summary.sales.malls.map((row) => Object.freeze({ ...row }))),
      events: Object.freeze(summary.sales.events.map((event) => Object.freeze({ ...event, time: utcTime(event.time) }))),
      insights: Object.freeze(summary.sales.insights.map((insight) => Object.freeze({ ...insight }))),
    }),
  });
}

export function utcTime(value: DatabaseTime): string {
  const parsed = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(parsed.getTime())) throw new Error('REPORT_TIME_INVALID');
  return parsed.toISOString();
}

function optionalTime(value: DatabaseTime | null): string | null {
  return value === null ? null : utcTime(value);
}

function array(value: unknown, length: number, code: string): readonly unknown[] {
  if (!Array.isArray(value) || value.length !== length) throw new Error(code);
  return value;
}

function record(value: unknown, code: string): Readonly<Record<string, unknown>> {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) throw new Error(code);
  return value as Readonly<Record<string, unknown>>;
}

function exportText(value: unknown, code: string): string {
  if (typeof value !== 'string' || !value || value.length > 4096) throw new Error(code);
  return value;
}

function nullableText(value: unknown, code: string): string | null {
  return value === null ? null : exportText(value, code);
}

function time(value: unknown, code: string): DatabaseTime {
  if (!(typeof value === 'string' || value instanceof Date) || Number.isNaN(new Date(value).getTime())) throw new Error(code);
  return value;
}

function positiveInteger(value: unknown, code: string): number {
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < 1) throw new Error(code);
  return value;
}

function finiteNumber(value: unknown, code: string): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) throw new Error(code);
  return value;
}

function stringArray(value: unknown, code: string): readonly string[] {
  if (!Array.isArray(value) || value.some((item) => typeof item !== 'string')) throw new Error(code);
  return value;
}

function literal<T extends string>(value: unknown, allowed: readonly T[], code: string): T {
  if (typeof value !== 'string' || !allowed.includes(value as T)) throw new Error(code);
  return value as T;
}
export function required<T>(value: T | undefined, code: string): T {
  if (value === undefined) throw new Error(code);
  return value;
}
export function object(value: unknown, code: string): Readonly<Record<string, unknown>> {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) throw new Error(code);
  return value as Readonly<Record<string, unknown>>;
}
export function text(value: unknown, code: string): string {
  if (typeof value !== 'string' || !value) throw new Error(code);
  return value;
}
export function integer(value: unknown): number {
  if (typeof value !== 'number' || !Number.isSafeInteger(value)) throw new Error('REPORT_INTEGER_INVALID');
  return value;
}
