import { token } from '../../../../bootstrap/Container';
import type { MetricSink } from '../../public/TelemetryPort';
export type { MetricSink } from '../../public/TelemetryPort';

export const METRIC_SINK = token<MetricSink>('observability.metric');
