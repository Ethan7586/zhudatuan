import { createTelemetry } from '@shop/telemetry';
import { describe, expect, it } from 'vitest';
import { JobMetrics } from '../../../foundation/telemetry/JobMetrics';
import { OperationMetrics } from '../../../foundation/telemetry/OperationMetrics';
import { ProviderMetrics } from '../../../foundation/telemetry/ProviderMetrics';

describe('Telemetry transaction isolation', () => {
  it('keeps a committed result when the telemetry backend is unavailable', async () => {
    const telemetry = createTelemetry(() => {
      throw new Error('backend unavailable');
    });
    const result = await businessTransaction(async () => {
      new OperationMetrics(telemetry).observe(context, 201, 18);
      return 'committed';
    });
    expect(result).toBe('committed');
  });

  it('propagates one correlation through operation, job and provider observations', () => {
    const records: Readonly<Record<string, unknown>>[] = [];
    const telemetry = createTelemetry((record) => {
      records.push(record);
    });
    new OperationMetrics(telemetry).observe(context, 200, 10);
    new JobMetrics(telemetry).observe({ id: 'job:one', kind: 'catalogimport', scope: 'mall:one', payload: { traceId: 'trace:one', correlationId: 'correlation:one' }, authorization: {}, attempts: 1, token: 1 }, 'catalog', 20, 'success');
    new ProviderMetrics(telemetry).observe('wechat', 'payment.create', context, 30, 'success');
    expect(records.filter(({ kind }) => kind === 'metric')).not.toHaveLength(0);
    expect(records.filter(({ kind }) => kind === 'metric').every(({ correlationId }) => correlationId === 'correlation:one')).toBe(true);
  });
});

const context = { requestId: 'request:one', traceId: 'trace:one', correlationId: 'correlation:one', module: 'order', operation: 'order.orders.create' };

async function businessTransaction<T>(work: () => Promise<T>): Promise<T> {
  return work();
}
