export interface Metric {
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

export type MetricUnit = Metric['unit'];

export type ReportPeriod = 'realtime' | 'yesterday' | '7days' | '30days';

export type ReportDimension = 'sales' | 'product' | 'mall' | 'category' | 'channel' | 'powderclass' | 'voucher'
  | 'fulfillment' | 'settlement';

export interface MetricQuery {
  readonly scope: string;
  readonly period: ReportPeriod;
  readonly dimension: ReportDimension | null;
  readonly application: string | null;
  readonly supplier: string | null;
  readonly cursorTime: string | null;
  readonly cursorId: string | null;
  readonly fetch: number;
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
    trend: readonly Readonly<{ date: string; salesCents: number; orderCount: number }>[];
    categories: readonly Readonly<{ name: string; salesCents: number; share: number }>[];
    topProducts: readonly never[];
  }>;
  readonly perspective?: Readonly<{ kind: 'supplier'; id: string; name: string; channel: string }>;
  readonly operations?: Readonly<{
    pendingFulfillmentCount: number;
    payableSettlementCents: number;
    paidSettlementCents: number;
  }>;
}
