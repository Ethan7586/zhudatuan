export interface CockpitMetric {
  readonly code: string;
  readonly version: number;
  readonly scope: string;
  readonly period: Readonly<{ from: string; to: string; timezone: string }>;
  readonly dimensions: Readonly<Record<string, string>>;
  readonly value: number;
  readonly unit: 'minor' | 'count' | 'ratio';
  readonly watermark: string;
  readonly projectionVersion: number;
}

export interface CockpitSales {
  readonly asOf: string;
  readonly cumulativeSalesCents: number;
  readonly paidOrderCount: number;
  readonly averageOrderValueCents: number;
  readonly periodSalesCents: number;
  readonly periodPaidOrderCount: number;
  readonly refundedCents: number;
  readonly activeProductCount: number;
  readonly soldProductCount: number;
  readonly unsoldActiveProductCount: number;
  readonly trend: readonly Trend[];
  readonly weeklyTrend?: readonly Trend[];
  readonly categories: readonly Readonly<{ name: string; salesCents: number; share: number }>[];
  readonly topProducts: readonly unknown[];
  readonly period?: Readonly<{ from: string; to: string }>;
  readonly conclusion?: string;
  readonly deltas?: Readonly<{
    netSalesRatio?: number;
    paidOrdersRatio?: number;
    averageOrderRatio?: number;
    refundRate?: number;
    refundRateDeltaPoints?: number;
  }>;
  readonly malls?: readonly MallPerformance[];
  readonly events?: readonly BusinessEvent[];
  readonly insights?: readonly BusinessInsight[];
}

export interface Trend { readonly date: string; readonly salesCents: number; readonly orderCount: number }
export interface MallPerformance {
  readonly id: string;
  readonly name: string;
  readonly salesCents: number;
  readonly paidOrderCount: number;
  readonly refundRate: number;
}
export interface BusinessEvent {
  readonly id: string;
  readonly kind: 'calendar' | 'warning' | 'sync';
  readonly title: string;
  readonly metric: string;
  readonly time: string;
  readonly date?: string;
}
export interface BusinessInsight {
  readonly id: string;
  readonly tone: 'warning' | 'positive';
  readonly title: string;
  readonly detail?: string;
  readonly action: string;
  readonly target?: 'orders' | 'reports';
}
export interface CockpitData {
  readonly items: readonly CockpitMetric[];
  readonly count: number;
  readonly nextCursor?: string;
  readonly summary: Readonly<{
    catalogCount: number;
    availableStock: number;
    orderCount: number;
    afterSaleCount: number;
    perspective?: Readonly<{ kind: 'supplier'; id: string; name: string; channel: string }>;
    operations?: Readonly<{
      pendingFulfillmentCount: number;
      payableSettlementCents: number;
      paidSettlementCents: number;
    }>;
    sales: CockpitSales;
  }>;
}

export const CockpitSchema = Object.freeze({
  parse(value: unknown): CockpitData {
    if (!isCockpitData(value)) throw new Error('COCKPIT_SCHEMA_INVALID');
    return value;
  },
  safeParse(value: unknown): Readonly<{ success: true; data: CockpitData } | { success: false; error: Error }> {
    return isCockpitData(value)
      ? { success: true, data: value }
      : { success: false, error: new Error('COCKPIT_SCHEMA_INVALID') };
  },
});

function isCockpitData(value: unknown): value is CockpitData {
  if (!isRecord(value) || !Array.isArray(value.items) || !value.items.every(isMetric)
    || !nonNegativeInteger(value.count) || !optionalNonEmpty(value.nextCursor) || !isRecord(value.summary)) return false;
  const summary = value.summary;
  return finite(summary.catalogCount) && finite(summary.availableStock) && finite(summary.orderCount)
    && finite(summary.afterSaleCount) && (summary.perspective === undefined || isPerspective(summary.perspective))
    && (summary.operations === undefined || isOperations(summary.operations)) && isSales(summary.sales);
}

function isPerspective(value: unknown): value is NonNullable<CockpitData['summary']['perspective']> {
  return isRecord(value) && value.kind === 'supplier' && nonEmpty(value.id) && nonEmpty(value.name) && nonEmpty(value.channel);
}

function isOperations(value: unknown): value is NonNullable<CockpitData['summary']['operations']> {
  return isRecord(value) && nonNegativeInteger(value.pendingFulfillmentCount)
    && finite(value.payableSettlementCents) && finite(value.paidSettlementCents);
}

function isMetric(value: unknown): value is CockpitMetric {
  return isRecord(value) && nonEmpty(value.code) && nonNegativeInteger(value.version) && nonEmpty(value.scope)
    && isPeriod(value.period, true) && isRecord(value.dimensions) && Object.values(value.dimensions).every((item) => typeof item === 'string')
    && finite(value.value) && ['minor', 'count', 'ratio'].includes(value.unit as string)
    && nonEmpty(value.watermark) && nonNegativeInteger(value.projectionVersion);
}

function isSales(value: unknown): value is CockpitSales {
  return isRecord(value) && nonEmpty(value.asOf)
    && ['cumulativeSalesCents', 'paidOrderCount', 'averageOrderValueCents', 'periodSalesCents', 'periodPaidOrderCount',
      'refundedCents', 'activeProductCount', 'soldProductCount', 'unsoldActiveProductCount'].every((key) => finite(value[key]))
    && isArrayOf(value.trend, isTrend) && optionalArrayOf(value.weeklyTrend, isTrend)
    && isArrayOf(value.categories, isCategory) && Array.isArray(value.topProducts)
    && (value.period === undefined || isPeriod(value.period, false)) && optionalNonEmpty(value.conclusion)
    && (value.deltas === undefined || isDeltas(value.deltas)) && optionalArrayOf(value.malls, isMall)
    && optionalArrayOf(value.events, isEvent) && optionalArrayOf(value.insights, isInsight);
}

function isTrend(value: unknown): value is Trend {
  return isRecord(value) && nonEmpty(value.date) && finite(value.salesCents) && finite(value.orderCount);
}

function isCategory(value: unknown): value is CockpitSales['categories'][number] {
  return isRecord(value) && nonEmpty(value.name) && finite(value.salesCents) && finite(value.share);
}

function isMall(value: unknown): value is MallPerformance {
  return isRecord(value) && nonEmpty(value.id) && nonEmpty(value.name) && finite(value.salesCents)
    && nonNegativeInteger(value.paidOrderCount) && finite(value.refundRate);
}

function isEvent(value: unknown): value is BusinessEvent {
  return isRecord(value) && nonEmpty(value.id) && ['calendar', 'warning', 'sync'].includes(value.kind as string)
    && nonEmpty(value.title) && nonEmpty(value.metric) && nonEmpty(value.time) && optionalNonEmpty(value.date);
}

function isInsight(value: unknown): value is BusinessInsight {
  return isRecord(value) && nonEmpty(value.id) && ['warning', 'positive'].includes(value.tone as string)
    && nonEmpty(value.title) && optionalNonEmpty(value.detail) && nonEmpty(value.action)
    && (value.target === undefined || ['orders', 'reports'].includes(value.target as string));
}

function isDeltas(value: unknown): value is NonNullable<CockpitSales['deltas']> {
  return isRecord(value) && ['netSalesRatio', 'paidOrdersRatio', 'averageOrderRatio', 'refundRate', 'refundRateDeltaPoints']
    .every((key) => value[key] === undefined || finite(value[key]));
}

function isPeriod(value: unknown, timezone: boolean): value is Readonly<{ from: string; to: string; timezone?: string }> {
  return isRecord(value) && nonEmpty(value.from) && nonEmpty(value.to) && (!timezone || nonEmpty(value.timezone));
}

function isArrayOf<T>(value: unknown, validate: (item: unknown) => item is T): value is readonly T[] {
  return Array.isArray(value) && value.every(validate);
}

function optionalArrayOf<T>(value: unknown, validate: (item: unknown) => item is T): value is readonly T[] | undefined {
  return value === undefined || isArrayOf(value, validate);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function nonEmpty(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0;
}

function optionalNonEmpty(value: unknown): value is string | undefined {
  return value === undefined || nonEmpty(value);
}

function finite(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function nonNegativeInteger(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value >= 0;
}
