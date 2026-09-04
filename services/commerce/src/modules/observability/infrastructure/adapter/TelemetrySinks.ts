import type { Telemetry } from '@shop/telemetry';
import type { LogEntry, LogSink, MetricSink, TraceSink } from '../../public/TelemetryPort';

export class TelemetryMetricSink implements MetricSink {
  constructor(private readonly telemetry: Telemetry) {}
  count: MetricSink['count'] = (name, value, context) => this.telemetry.metrics.count(name, value, context);
  duration: MetricSink['duration'] = (name, milliseconds, context) => this.telemetry.metrics.duration(name, milliseconds, context);
}

export class TelemetryTraceSink implements TraceSink {
  constructor(private readonly telemetry: Telemetry) {}
  start: TraceSink['start'] = (name, context) => this.telemetry.tracer.start(name, context);
}

export class TelemetryLogSink implements LogSink {
  constructor(private readonly telemetry: Telemetry) {}
  write(record: LogEntry): void | Promise<void> {
    return this.telemetry.logger.write(record);
  }
}
