export const cockpitPeriods = ['realtime', 'yesterday', '7days', '30days'] as const;
export type CockpitPeriod = (typeof cockpitPeriods)[number];

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
  readonly period: Readonly<{ from: string; to: string }>;
  readonly conclusion: string;
  readonly deltas: CockpitDeltas;
  readonly trend: readonly Trend[];
  readonly weeklyTrend: readonly Trend[];
  readonly categories: readonly CategoryPerformance[];
  readonly malls: readonly MallPerformance[];
  readonly events: readonly BusinessEvent[];
  readonly insights: readonly BusinessInsight[];
}

export interface Trend { readonly date: string; readonly salesCents: number; readonly orderCount: number }
export interface CategoryPerformance { readonly name: string; readonly salesCents: number; readonly share: number }
export interface CockpitDeltas { readonly netSalesRatio: number | null; readonly paidOrdersRatio: number | null; readonly averageOrderRatio: number | null; readonly refundRate: number; readonly refundRateDeltaPoints: number | null }
export interface MallPerformance { readonly id: string; readonly name: string; readonly salesCents: number; readonly paidOrderCount: number; readonly refundRate: number }
export interface BusinessEvent { readonly id: string; readonly kind: 'calendar' | 'warning' | 'sync'; readonly title: string; readonly metric: string; readonly time: string; readonly date: string }
export interface BusinessInsight { readonly id: string; readonly tone: 'warning' | 'positive'; readonly title: string; readonly detail: string; readonly action: string; readonly target: 'orders' | 'reports' }
export interface CockpitData {
  readonly items: readonly CockpitMetric[];
  readonly count: number;
  readonly nextCursor?: string;
  readonly summary: Readonly<{ catalogCount: number; availableStock: number; orderCount: number; afterSaleCount: number; sales: CockpitSales }>;
}

export interface CockpitFilter { readonly period: CockpitPeriod; readonly application?: string }
