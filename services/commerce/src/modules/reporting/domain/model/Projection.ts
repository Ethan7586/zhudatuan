import type { MetricContribution, MetricUnit } from './Metric';
import { dimensionRecord, timezoneName } from '../value/Dimension';

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
  readonly sourceEvent: string;
  readonly order: string;
  readonly scopes: readonly string[];
  readonly number: string;
  readonly totalMinor: number;
  readonly currency: string;
  readonly occurredAt: string;
  readonly snapshot: Readonly<Record<string, unknown>>;
}

export function projectedMetric(
  code: string,
  scope: string,
  period: DailyPeriod,
  dimensions: Readonly<Record<string, string>>,
  value: number,
  unit: MetricUnit,
  currency: string | null,
  watermark: string
): MetricContribution {
  if (
    !/^[a-z][a-z0-9]+(?:\.[a-z][a-z0-9]+)+$/.test(code) ||
    !scope ||
    !Number.isSafeInteger(value) ||
    value < 0 ||
    Number.isNaN(Date.parse(period.from)) ||
    Number.isNaN(Date.parse(period.to)) ||
    Date.parse(period.from) >= Date.parse(period.to) ||
    Number.isNaN(Date.parse(watermark)) ||
    (unit === 'minor') !== (currency !== null) ||
    (currency !== null && !/^[A-Z]{3}$/.test(currency))
  ) throw new Error('REPORT_METRIC_INVALID');
  let timezone: string;
  try {
    timezone = timezoneName(period.timezone);
  } catch {
    throw new Error('REPORT_METRIC_INVALID');
  }
  return Object.freeze({ code, scope, period: Object.freeze({ ...period, timezone }), dimensions: dimensionRecord(dimensions), value, unit, currency, watermark });
}
