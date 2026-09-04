import type { TelemetryContext } from '@shop/telemetry';

export interface MetricSink {
  count(name: string, value: number, context: TelemetryContext): void;
  duration(name: string, milliseconds: number, context: TelemetryContext): void;
}

export interface TraceHandle {
  readonly context: TelemetryContext;
  attribute(name: string, value: string | number | boolean): void;
  end(error?: Error): void;
}

export interface TraceSink {
  start(name: string, context: TelemetryContext): TraceHandle;
}

export interface LogEntry extends TelemetryContext {
  readonly level: 'debug' | 'info' | 'warn' | 'error';
  readonly event: string;
  readonly data?: Readonly<Record<string, unknown>>;
}

export interface LogSink {
  write(record: LogEntry): void | Promise<void>;
}
