import type { OperationInputFor, OperationOutputFor } from '@shop/contract';
import type { HandlerContext } from '../../../../pipeline/HandlerContext';
import type { OperationReply } from '../../../../pipeline/OperationHandler';
import { limit } from '../../../../pipeline/Validation';
import { requireSession } from '../../../../platform/security/OperationSecurityContext';
import type { CockpitSummary, Metric, ReportDimension, ReportPeriod } from '../../domain/model/Metric';
import { ReportSnapshot, type ReportQuery } from '../../domain/model/ReportSnapshot';
import { timezoneName } from '../../domain/value/Dimension';
import type { ReportRepository } from '../port/ReportRepository';
import type { DimensionReader } from './DimensionReader';

export class MetricReader {
  constructor(
    private readonly reports: ReportRepository,
    private readonly dimensions: DimensionReader
  ) {}

  async read<TKey extends MetricOperation>(operation: TKey, input: OperationInputFor<TKey>, context: HandlerContext<TKey>, dimension: ReportDimension | null): Promise<OperationReply<OperationOutputFor<TKey>>> {
    if (context.operation !== operation) throw new Error('REPORT_OPERATION_MISMATCH');
    const scope = requireSession(context.security).scope.id;
    const requested = limit(input);
    const selectedPeriod = period(queryText(input.query, 'period'));
    const application = queryText(input.query, 'applicationid');
    const query = Object.freeze({ scope, dimension, period: selectedPeriod, application }) satisfies ReportQuery;
    const encoded = queryText(input.query, 'cursor', 2048);
    const resumed = encoded === null ? null : ReportSnapshot.resume(encoded, query);
    const snapshot = resumed?.snapshot ?? new ReportSnapshot(query, await this.reports.watermark(context.transaction, scope), new Date().toISOString());
    const [rows, summary] = await Promise.all([
      this.reports.metrics(context.transaction, {
        ...query,
        watermarkAt: snapshot.watermark.occurredAt,
        watermarkVersion: snapshot.watermark.version,
        snapshotAt: snapshot.generatedAt,
        cursorTime: resumed?.sort ?? null,
        cursorId: resumed?.row ?? null,
        fetch: requested + 1,
      }),
      dimension === null
        ? this.reports.cockpit(context.transaction, {
            scope,
            period: selectedPeriod,
            application,
            watermarkAt: snapshot.watermark.occurredAt,
            watermarkVersion: snapshot.watermark.version,
            snapshotAt: snapshot.generatedAt,
          })
        : Promise.resolve(undefined),
    ]);
    const more = rows.length > requested;
    const visible = more ? rows.slice(0, requested) : rows;
    const last = visible.at(-1);
    const governed = visible.map(({ cursorTime: _time, cursorId: _id, ...metric }) => present(metric, scope, snapshot.watermark.occurredAt));
    const presentation = await this.dimensions.resolve(context.transaction, scope, governed, summary?.sales.categories.map(({ name }) => name) ?? []);
    const items = presentation.metrics;
    const nextCursor = more && last ? snapshot.cursor(last.cursorTime, last.cursorId) : undefined;
    const body = {
      items,
      count: items.length,
      ...(nextCursor ? { nextCursor } : {}),
      snapshot: snapshot.toJSON(),
      ...(summary === undefined ? {} : { summary: presentSummary(summary, snapshot.watermark.occurredAt, presentation.categoryNames) }),
    };
    return { status: 200, body: body as OperationOutputFor<TKey> };
  }
}

function present<T extends Metric>(metric: T, scope: string, watermark: string): T {
  if (
    metric.scope !== scope ||
    metric.definition.owner !== 'reporting' ||
    !Number.isFinite(metric.value) ||
    Number.isNaN(Date.parse(metric.watermark)) ||
    Date.parse(metric.watermark) > Date.parse(watermark) ||
    Number.isNaN(Date.parse(metric.period.from)) ||
    Number.isNaN(Date.parse(metric.period.to)) ||
    Date.parse(metric.period.from) >= Date.parse(metric.period.to)
  ) {
    throw new Error('REPORT_METRIC_RESULT_INVALID');
  }
  timezoneName(metric.period.timezone);
  const value = metric.unit === 'ratio' ? metric.value : Math.round(metric.value);
  if ((metric.unit === 'minor') !== (metric.currency !== null)) throw new Error('REPORT_METRIC_CURRENCY_INVALID');
  return Object.freeze({ ...metric, value });
}

function presentSummary(summary: CockpitSummary, watermark: string, categoryNames: ReadonlyMap<string, string>): CockpitSummary {
  const sales = summary.sales;
  const integerKeys = ['cumulativeSalesCents', 'paidOrderCount', 'averageOrderValueCents', 'periodSalesCents', 'periodPaidOrderCount', 'refundedCents', 'activeProductCount', 'soldProductCount', 'unsoldActiveProductCount'] as const;
  const normalized: Record<string, unknown> = { ...sales, asOf: watermark };
  for (const key of integerKeys) {
    const value = sales[key];
    normalized[key] = whole(value);
  }
  const deltas = sales.deltas;
  normalized.deltas = Object.freeze({
    netSalesRatio: nullableRatio(deltas.netSalesRatio),
    paidOrdersRatio: nullableRatio(deltas.paidOrdersRatio),
    averageOrderRatio: nullableRatio(deltas.averageOrderRatio),
    refundRate: ratio(deltas.refundRate),
    refundRateDeltaPoints: nullableRatio(deltas.refundRateDeltaPoints),
  });
  normalized.trend = normalizeTrend(sales.trend);
  normalized.weeklyTrend = normalizeTrend(sales.weeklyTrend);
  normalized.categories = Object.freeze(sales.categories.map((row) => Object.freeze({ ...row, name: categoryNames.get(row.name) ?? '已停用或无权查看的分类', salesCents: whole(row.salesCents), share: ratio(row.share) })));
  normalized.topProducts = Object.freeze(sales.topProducts.map((row) => Object.freeze({ ...row, salesCents: whole(row.salesCents), quantity: whole(row.quantity), orderCount: whole(row.orderCount) })));
  normalized.malls = Object.freeze(sales.malls.map((row) => Object.freeze({ ...row, salesCents: whole(row.salesCents), paidOrderCount: whole(row.paidOrderCount), refundRate: ratio(row.refundRate) })));
  return Object.freeze({
    ...summary,
    catalogCount: whole(summary.catalogCount),
    availableStock: integer(summary.availableStock),
    orderCount: whole(summary.orderCount),
    afterSaleCount: whole(summary.afterSaleCount),
    sales: Object.freeze(normalized) as CockpitSummary['sales'],
  });
}

function normalizeTrend(rows: CockpitSummary['sales']['trend']): CockpitSummary['sales']['trend'] {
  return Object.freeze(rows.map((row) => Object.freeze({ ...row, salesCents: whole(row.salesCents), orderCount: whole(row.orderCount) })));
}

function whole(value: number): number {
  if (!Number.isFinite(value) || value < 0) throw new Error('REPORT_SUMMARY_INVALID');
  return Math.round(value);
}

function integer(value: number): number {
  if (!Number.isFinite(value)) throw new Error('REPORT_SUMMARY_INVALID');
  return Math.round(value);
}

function ratio(value: number): number {
  if (!Number.isFinite(value)) throw new Error('REPORT_SUMMARY_INVALID');
  return value;
}

function nullableRatio(value: number | null): number | null {
  return value === null ? null : ratio(value);
}

export type MetricOperation = 'reporting.dashboard.read' | 'reporting.sales.read' | 'reporting.products.read' | 'reporting.malls.read' | 'reporting.categories.read' | 'reporting.channels.read' | 'reporting.voucherconsumption.read';

function period(value: string | null): ReportPeriod {
  if (value === null || value === 'realtime') return 'realtime';
  if (value === 'yesterday' || value === '7days' || value === '30days') return value;
  throw new Error('REPORT_PERIOD_INVALID');
}

function queryText(query: Readonly<Record<string, unknown>> | undefined, name: string, maximum = 100): string | null {
  const raw = query?.[name];
  const value = Array.isArray(raw) ? raw[0] : raw;
  if (value === undefined || value === null) return null;
  if (typeof value !== 'string' || value.length === 0 || value.length > maximum) throw new Error('REPORT_FILTER_INVALID');
  return value;
}
