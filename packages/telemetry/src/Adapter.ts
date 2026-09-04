import { Logger, type LogSink } from './Logger';
import type { Metrics } from './Metrics';
import type { Telemetry } from './Telemetry';
import type { TelemetryContext } from './Context';
import type { Tracer, TraceSpan } from './Tracer';
import { Redactor } from './Redactor';
import { ClientErrorBuffer } from './ClientErrors';
import { TELEMETRY_SAMPLING } from './RedactionCatalog';
import { TELEMETRY_BUFFER } from './RedactionCatalog';
import { ObservationBuffer } from './Observations';
import type { ObservableTelemetry } from './Telemetry';

export type TelemetryWriter = (record: Readonly<Record<string, unknown>>) => void | Promise<void>;

export function createTelemetry(writer: TelemetryWriter): ObservableTelemetry {
  const redactor = new Redactor();
  const observations = new ObservationBuffer(TELEMETRY_BUFFER.capacity, TELEMETRY_BUFFER.retentionSeconds * 1_000, TELEMETRY_BUFFER.maximumRead);
  const safe: TelemetryWriter = (record) => {
    const value = Object.freeze(redactor.redact(record) as Readonly<Record<string, unknown>>);
    observations.record(value);
    try {
      const result = writer(value);
      if (isPromiseLike(result)) void Promise.resolve(result).catch(() => observations.record(backendFailure()));
    } catch {
      observations.record(backendFailure());
    }
  };
  const sink: LogSink = { write: safe };
  return Object.freeze({ logger: new Logger(sink), metrics: new SinkMetrics(safe), tracer: new SinkTracer(safe), clientErrors: new ClientErrorBuffer(safe, 2_000, 7 * 24 * 60 * 60 * 1_000, () => Date.now(), TELEMETRY_SAMPLING.errors), observations });
}

function backendFailure(): Readonly<Record<string, unknown>> {
  return Object.freeze({ kind: 'telemetryhealth', event: 'telemetry.backend.failure', result: 'degraded' });
}

function isPromiseLike(value: void | Promise<void>): value is Promise<void> {
  return value !== undefined && typeof value.then === 'function';
}

class SinkMetrics implements Metrics {
  constructor(private readonly write: TelemetryWriter) {}
  count(name: string, value: number, context: TelemetryContext): void {
    void this.write({ kind: 'metric', type: 'count', name, value, ...context });
  }
  duration(name: string, milliseconds: number, context: TelemetryContext): void {
    void this.write({ kind: 'metric', type: 'duration', name, value: milliseconds, ...context });
  }
}

class SinkTracer implements Tracer {
  constructor(private readonly write: TelemetryWriter) {}
  start(name: string, context: TelemetryContext): TraceSpan {
    const started = performance.now();
    const attributes: Record<string, string | number | boolean> = {};
    return Object.freeze({
      context,
      attribute(key: string, value: string | number | boolean) {
        attributes[key] = value;
      },
      end: (error?: Error) => {
        void this.write({ kind: 'span', name, durationMs: performance.now() - started, ...context, attributes, ...(error === undefined ? { result: 'success' } : { result: 'failure', errorCode: error.message.slice(0, 120) }) });
      },
    });
  }
}
