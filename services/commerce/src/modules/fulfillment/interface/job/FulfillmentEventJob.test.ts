import { describe, expect, it, vi } from 'vitest';
import type { ClaimedJob } from '../../../runtime/public/JobProcess';
import type { ProcessFulfillmentEvent } from '../../application/process/ProcessFulfillmentEvent';
import { FulfillmentEventJob } from './FulfillmentEventJob';

describe('FulfillmentEventJob', () => {
  it.each([
    ['order.paid', 'order:one', { order: 'order:one', payment: 'payment:one' }, { eventType: 'order.paid', resourceId: 'order:one', paymentId: 'payment:one' }],
    ['aftersale.changed', 'aftersale:one', { aftersale: 'aftersale:one', order: 'order:one', previousState: 'reviewing', state: 'approved' }, { eventType: 'aftersale.changed', resourceId: 'aftersale:one', kind: 'approved' }],
    ['channel.webhook.applied', 'webhook:one', { webhook: 'webhook:one', kind: 'tracking', internalReference: 'fulfillment:one' }, { eventType: 'channel.webhook.applied', resourceId: 'fulfillment:one', kind: 'tracking' }],
    [
      'verification.completed',
      'verification:one',
      { verification: 'verification:one', subjectType: 'fulfillment', subject: 'fulfillment:one' },
      { eventType: 'verification.completed', resourceId: 'fulfillment:one', subjectType: 'fulfillment' },
    ],
  ] as const)('maps %s into an explicit domain event', async (event, aggregateId, payload, expected) => {
    const execute = vi.fn(async () => undefined);
    const job = new FulfillmentEventJob({ execute } as unknown as ProcessFulfillmentEvent);
    await job.process(claimed(event, aggregateId, payload), new AbortController().signal, 123);
    expect(execute).toHaveBeenCalledWith(expect.objectContaining({ eventId: 'event:one', scopeId: 'mall:one', sourceId: aggregateId, ...expected }), expect.any(AbortSignal), 123);
  });

  it('rejects a cross-scope delivery before application code runs', () => {
    const job = new FulfillmentEventJob({ execute: vi.fn() } as unknown as ProcessFulfillmentEvent);
    expect(() => job.process({ ...claimed('order.paid', 'order:one', { order: 'order:one', payment: 'payment:one' }), scope: 'mall:other' }, new AbortController().signal)).toThrow('FULFILLMENT_SCOPE_MISMATCH');
  });
});

function claimed(event: string, aggregateId: string, payload: Readonly<Record<string, unknown>>): ClaimedJob {
  return {
    id: 'job:one',
    kind: 'fulfillmentevent',
    scope: 'mall:one',
    attempts: 1,
    token: 1,
    authorization: { kind: 'system', actor: 'test', scope: 'mall:one', operation: 'test', source: 'jobs', capturedAt: new Date().toISOString() },
    payload: { eventId: 'event:one', event, scopeId: 'mall:one', aggregateId, payload },
  };
}
