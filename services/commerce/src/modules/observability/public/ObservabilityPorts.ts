import { publicPort } from '../../../bootstrap/ModuleRegistry';
import type { LogSink, MetricSink, TraceSink } from './TelemetryPort';

export type ObservabilityMetricPort = MetricSink;

export interface ObservabilityCatalog {
  readonly healthChecks: readonly string[];
  readonly metrics: readonly string[];
  readonly serviceLevels: readonly Readonly<{ id: string; title: string; owner: string; severity: string; runbook: string }>[];
  readonly alerts: readonly Readonly<{ id: string; title: string; owner: string; severity: string; runbook: string }>[];
}

export const OBSERVABILITY_METRIC_PORT = publicPort<MetricSink>('observability', 'metric');
export const OBSERVABILITY_TRACE_PORT = publicPort<TraceSink>('observability', 'trace');
export const OBSERVABILITY_LOG_PORT = publicPort<LogSink>('observability', 'log');
export const OBSERVABILITY_CATALOG_PORT = publicPort<ObservabilityCatalog>('observability', 'catalog');
