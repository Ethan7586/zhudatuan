import type { ReportMetric } from './Report';

export function reportMetricKey(metric: ReportMetric): string {
  return JSON.stringify([metric.code, metric.version, metric.scope, metric.period.from, metric.dimensions]);
}
