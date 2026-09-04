import type { ExportFilterValue, ExportJob, ExportReport, ExportSnapshot } from '../../domain/model/ExportJob';
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
