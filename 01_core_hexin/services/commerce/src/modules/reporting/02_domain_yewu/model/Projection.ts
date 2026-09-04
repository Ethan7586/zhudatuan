import type { Metric, MetricUnit } from './Metric';

export interface ProjectionEvent {
  readonly id: string;
  readonly type: string;
  readonly version: number;
  readonly aggregate: string;
  readonly scope: string;
  readonly payload: Readonly<Record<string, unknown>>;
  readonly occurredAt: string;
}

export interface DailyPeriod {
  readonly from: string;
  readonly to: string;
  readonly timezone: string;
}

export interface OrderProjection {
  readonly order: string;
  readonly scopes: readonly string[];
  readonly number: string;
  readonly totalMinor: number;
  readonly currency: string;
  readonly occurredAt: string;
  readonly snapshot: Readonly<Record<string, unknown>>;
}

export function projectedMetric(code: string, scope: string, period: DailyPeriod, dimensions: Readonly<Record<string, string>>,
  value: number, unit: MetricUnit, watermark: string): Metric {
  if (!code || !scope || !Number.isSafeInteger(value) || value < 0 || Number.isNaN(Date.parse(watermark))) throw new Error('REPORT_METRIC_INVALID');
  return Object.freeze({ code, version: 1, scope, period, dimensions: Object.freeze({ ...dimensions }), value, unit, watermark, projectionVersion: 1 });
}
