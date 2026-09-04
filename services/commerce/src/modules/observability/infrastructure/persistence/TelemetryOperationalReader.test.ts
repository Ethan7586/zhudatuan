import { ObservationBuffer } from '@shop/telemetry';
import { describe, expect, it } from 'vitest';
import { TelemetryOperationalReader } from './TelemetryOperationalReader';
import { OBSERVATION_REGISTRY } from '../registry/TelemetryCatalog';

describe('TelemetryOperationalReader', () => {
  it('correlates dependency, queue and provider health with the current release', async () => {
    const observations = buffer();
    observations.record(metric('commerce.dependency.duration', 24, { dependency: 'database', result: 'success' }));
    observations.record(metric('commerce.queue.depth', 12, { queue: 'jobs', result: 'active' }));
    observations.record(metric('commerce.provider.count', 1, { provider: 'wechat', operation: 'payment.create', result: 'failure' }));
    const overview = await new TelemetryOperationalReader(observations, OBSERVATION_REGISTRY, () => timestamp).overview();
    expect(overview.dependencies).toEqual([expect.objectContaining({ name: 'database', state: 'healthy', traceId: 'trace:one' })]);
    expect(overview.queues).toEqual([expect.objectContaining({ name: 'jobs', depth: 12, state: 'active' })]);
    expect(overview.providers).toEqual([expect.objectContaining({ name: 'wechat', state: 'degraded', operation: 'payment.create' })]);
    expect(overview.release).toMatchObject({ schema: expect.stringMatching(/^\d{14}$/), contract: expect.stringMatching(/^[a-f0-9]{64}$/), configuration: expect.stringMatching(/^[a-f0-9]{64}$/) });
    expect(overview.degraded).toContain('provider.wechat');
  });

  it('calculates availability burn and reports no data explicitly', async () => {
    const empty = await new TelemetryOperationalReader(buffer(), OBSERVATION_REGISTRY, () => timestamp).serviceLevels();
    expect(empty.items[0]).toMatchObject({ status: 'nodata', current: null, burnRate: null, total: 0 });
    const observations = buffer();
    observations.record(metric('commerce.operation.count', 999, { result: 'success' }));
    observations.record(metric('commerce.operation.count', 1, { result: 'failure' }));
    const report = await new TelemetryOperationalReader(observations, OBSERVATION_REGISTRY, () => timestamp).serviceLevels();
    expect(report.items[0]).toMatchObject({ current: 99.9, status: 'atrisk', total: 1000 });
    expect(report.items[0]!.burnRate).toBeCloseTo(2);
  });
});

const timestamp = Date.parse('2026-09-06T05:00:00.000Z');

function buffer(): ObservationBuffer {
  return new ObservationBuffer(5_000, 3_600_000, 5_000, () => timestamp);
}

function metric(name: string, value: number, context: Readonly<Record<string, unknown>>): Readonly<Record<string, unknown>> {
  return Object.freeze({ kind: 'metric', type: 'count', name, value, requestId: 'request:one', traceId: 'trace:one', ...context });
}
