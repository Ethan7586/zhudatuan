import { describe, expect, it, vi } from 'vitest';
import type { ClaimedJob } from '../../runtime/public/JobProcess';
import type { ProcessOrderEvent } from '../application/process/ProcessOrderEvent';
import { OrderEventJob } from '../interface/job/OrderEventJob';

describe('OrderEventJob', () => {
  it.each([
    ['payment.captured', { payment: 'payment:one', order: 'order:one' }, 'payment:one'],
    ['refund.completed', { refund: 'refund:one', order: 'order:one' }, 'refund:one'],
    ['fulfillment.shipped', { fulfillment: 'fulfillment:one', order: 'order:one' }, 'fulfillment:one'],
  ])('maps %s to its producer aggregate and order target', async (event, payload, sourceId) => {
    const execute = vi.fn(async () => undefined);
    const processor = { execute } as unknown as ProcessOrderEvent;
    const job = new OrderEventJob(processor);
    const signal = new AbortController().signal;
    await job.process(claimed(event, payload), signal, 100);
    expect(execute).toHaveBeenCalledWith(expect.objectContaining({ eventId: 'event:one', eventType: event, scopeId: 'mall:one', sourceId, orderId: 'order:one' }), signal, 100);
  });

  it('rejects an envelope whose scope or producer aggregate is absent', async () => {
    const processor = { execute: vi.fn() } as unknown as ProcessOrderEvent;
    const job = new OrderEventJob(processor);
    const signal = new AbortController().signal;
    await expect(job.process({ ...claimed('payment.captured', { payment: 'payment:one', order: 'order:one' }), scope: 'mall:other' }, signal)).rejects.toThrow('ORDER_EVENT_SCOPE_MISMATCH');
    await expect(job.process(claimed('payment.captured', { order: 'order:one' }), signal)).rejects.toThrow('ORDER_EVENT_INVALID');
    expect(processor.execute).not.toHaveBeenCalled();
  });
});

function claimed(event: string, payload: Readonly<Record<string, unknown>>): ClaimedJob {
  return {
    id: 'job:one',
    kind: 'orderevent',
    scope: 'mall:one',
    authorization: { kind: 'system', actor: 'test', scope: 'mall:one', operation: 'test', source: 'jobs', capturedAt: new Date().toISOString() },
    payload: { eventId: 'event:one', event, scopeId: 'mall:one', payload },
    attempts: 0,
    token: 1,
  };
}
