import type { TelemetryContext } from './Context';

export interface TraceSpan {
  readonly context: TelemetryContext;
  attribute(name: string, value: string | number | boolean): void;
  end(error?: Error): void;
}

export interface Tracer {
  start(name: string, context: TelemetryContext): TraceSpan;
}
