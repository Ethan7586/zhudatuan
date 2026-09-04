import { createTelemetry } from '@shop/telemetry';
import { describe, expect, it } from 'vitest';
import { TelemetryLogSink, TelemetryMetricSink, TelemetryTraceSink } from './TelemetrySinks';

describe('Telemetry sinks', () => {
  it('delegates vendor-neutral metrics, traces and logs to the injected backend', () => {
    const records: Readonly<Record<string, unknown>>[] = [];
    const telemetry = createTelemetry((record) => {
      records.push(record);
    });
    const context = { requestId: 'request:one', traceId: 'trace:one', correlationId: 'correlation:one', module: 'observability' };
    new TelemetryMetricSink(telemetry).count('commerce.test.count', 1, context);
    const span = new TelemetryTraceSink(telemetry).start('commerce.test', context);
    span.attribute('outcome', 'success');
    span.end();
    new TelemetryLogSink(telemetry).write({ ...context, level: 'info', event: 'commerce.test.completed' });
    expect(records).toEqual([
      expect.objectContaining({ kind: 'metric', name: 'commerce.test.count', traceId: 'trace:one' }),
      expect.objectContaining({ kind: 'span', name: 'commerce.test', traceId: 'trace:one' }),
      expect.objectContaining({ level: 'info', event: 'commerce.test.completed', traceId: 'trace:one' }),
    ]);
  });
});
