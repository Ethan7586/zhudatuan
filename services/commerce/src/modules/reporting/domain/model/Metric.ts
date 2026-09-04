export interface MetricDefinition {
  readonly name: string;
  readonly formula: string;
  readonly dimensions: readonly string[];
  readonly granularity: 'day';
  readonly owner: 'reporting';
}

export interface MetricContribution {
  readonly code: string;
  readonly scope: string;
  readonly period: Readonly<{ from: string; to: string; timezone: string }>;
  readonly dimensions: Readonly<Record<string, string>>;
  readonly value: number;
  readonly unit: 'minor' | 'count' | 'ratio';
  readonly currency: string | null;
  readonly watermark: string;
}

export interface Metric extends MetricContribution {
  readonly version: number;
  readonly definition: MetricDefinition;
  readonly projectionVersion: number;
}

export type MetricUnit = Metric['unit'];

export type ReportPeriod = 'realtime' | 'yesterday' | '7days' | '30days';

export type ReportDimension = 'sales' | 'product' | 'mall' | 'category' | 'channel' | 'voucher' | 'member';

export interface MetricQuery {
  readonly scope: string;
  readonly period: ReportPeriod;
  readonly dimension: ReportDimension | null;
  readonly application: string | null;
  readonly watermarkAt: string;
  readonly watermarkVersion: number;
  readonly snapshotAt: string;
  readonly cursorTime: string | null;
  readonly cursorId: string | null;
  readonly fetch: number;
}

export interface CockpitQuery {
  readonly scope: string;
  readonly period: ReportPeriod;
  readonly application: string | null;
  readonly watermarkAt: string;
  readonly watermarkVersion: number;
  readonly snapshotAt: string;
}

export interface MetricRow extends Metric {
  readonly cursorTime: string;
  readonly cursorId: string;
}

export interface CockpitSummary {
  readonly catalogCount: number;
  readonly availableStock: number;
  readonly orderCount: number;
  readonly afterSaleCount: number;
  readonly sales: Readonly<{
    asOf: string;
    cumulativeSalesCents: number;
    paidOrderCount: number;
    averageOrderValueCents: number;
    periodSalesCents: number;
    periodPaidOrderCount: number;
    refundedCents: number;
    activeProductCount: number;
    soldProductCount: number;
    unsoldActiveProductCount: number;
    period: Readonly<{ from: string; to: string }>;
    conclusion: string;
    deltas: Readonly<{
      netSalesRatio: number | null;
      paidOrdersRatio: number | null;
      averageOrderRatio: number | null;
      refundRate: number;
      refundRateDeltaPoints: number | null;
    }>;
    trend: readonly CockpitTrend[];
    weeklyTrend: readonly CockpitTrend[];
    categories: readonly Readonly<{ name: string; salesCents: number; share: number }>[];
    topProducts: readonly CockpitProduct[];
    malls: readonly CockpitMall[];
    events: readonly CockpitEvent[];
    insights: readonly CockpitInsight[];
  }>;
}

export interface CockpitTrend {
  readonly date: string;
  readonly salesCents: number;
  readonly orderCount: number;
}

export interface CockpitProduct {
  readonly productId: string;
  readonly name: string;
  readonly salesCents: number;
  readonly quantity: number;
  readonly orderCount: number;
}

export interface CockpitMall {
  readonly id: string;
  readonly name: string;
  readonly salesCents: number;
  readonly paidOrderCount: number;
  readonly refundRate: number;
}

export interface CockpitEvent {
  readonly id: string;
  readonly kind: 'calendar' | 'warning' | 'sync';
  readonly title: string;
  readonly metric: string;
  readonly time: string;
  readonly date: string;
}

export interface CockpitInsight {
  readonly id: string;
  readonly tone: 'warning' | 'positive';
  readonly title: string;
  readonly detail: string;
  readonly action: string;
  readonly target: 'orders' | 'reports';
}
