import { describe, expect, it } from 'vitest';
import { createTelemetry } from './Adapter';

describe('Telemetry adapter isolation', () => {
  it('contains synchronous backend failures and preserves local diagnostics', () => {
    const telemetry = createTelemetry(() => {
      throw new Error('backend unavailable');
    });
    expect(() => telemetry.metrics.count('commerce.operation.count', 1, context)).not.toThrow();
    expect(() => telemetry.tracer.start('operation', context).end()).not.toThrow();
    expect(() => telemetry.logger.write({ ...context, level: 'error', event: 'commerce.operation.failure' })).not.toThrow();
    const records = telemetry.observations.read(new Date(Date.now() - 1_000).toISOString(), 100);
    expect(records.filter(({ record }) => record.event === 'telemetry.backend.failure')).toHaveLength(3);
  });

  it('contains asynchronous backend rejection without an unhandled failure', async () => {
    const telemetry = createTelemetry(() => ({
      then(_resolve: (value: void) => void, reject: (reason: unknown) => void) {
        reject(new Error('backend unavailable'));
      },
    } as Promise<void>));
    telemetry.metrics.count('commerce.operation.count', 1, context);
    await Promise.resolve();
    await Promise.resolve();
    const records = telemetry.observations.read(new Date(Date.now() - 1_000).toISOString(), 100);
    expect(records.some(({ record }) => record.event === 'telemetry.backend.failure')).toBe(true);
  });
});

const context = { requestId: 'request:one', traceId: 'trace:one', correlationId: 'correlation:one', module: 'test' };
