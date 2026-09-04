import { Logger, type LogSink } from './Logger';
import type { Metrics } from './Metrics';
import type { Telemetry } from './Telemetry';
import type { TelemetryContext } from './Context';
import type { Tracer, TraceSpan } from './Tracer';
import { Redactor } from './Redactor';
import { ClientErrorBuffer } from './ClientErrors';

export type TelemetryWriter = (record: Readonly<Record<string, unknown>>) => void | Promise<void>;

export function createTelemetry(writer: TelemetryWriter): Telemetry {
  const redactor = new Redactor();
  const safe: TelemetryWriter = (record) => writer(redactor.redact(record) as Readonly<Record<string, unknown>>);
  const sink: LogSink = { write: safe };
  return Object.freeze({ logger: new Logger(sink), metrics: new SinkMetrics(safe), tracer: new SinkTracer(safe),
    clientErrors: new ClientErrorBuffer(safe) });
}

class SinkMetrics implements Metrics {
  constructor(private readonly write: TelemetryWriter) {}
  count(name: string, value: number, context: TelemetryContext): void { void this.write({ kind: 'metric', type: 'count', name, value, ...context }); }
  duration(name: string, milliseconds: number, context: TelemetryContext): void {
    void this.write({ kind: 'metric', type: 'duration', name, value: milliseconds, ...context });
  }
}

class SinkTracer implements Tracer {
  constructor(private readonly write: TelemetryWriter) {}
  start(name: string, context: TelemetryContext): TraceSpan {
    const started = performance.now();
    const attributes: Record<string, string | number | boolean> = {};
    return Object.freeze({ context, attribute(key: string, value: string | number | boolean) { attributes[key] = value; }, end: (error?: Error) => {
      void this.write({ kind: 'span', name, durationMs: performance.now()-started, ...context, attributes,
        ...(error === undefined ? { result: 'success' } : { result: 'failure', errorCode: error.message.slice(0, 120) }) });
    } });
  }
}
