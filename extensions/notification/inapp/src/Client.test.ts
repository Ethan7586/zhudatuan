import { describe, expect, it } from 'vitest';
import { InappFactory } from './Factory';

describe('InappClient', () => {
  it('returns the business idempotency key as its canonical receipt', async () => {
    const client = InappFactory.create();
    await expect(client.send({ recipient: 'member:member-1', providerTemplate: null, purpose: 'transactional', variables: {}, subject: null, body: '通知', idempotency: 'dispatch-1' })).resolves.toEqual({ provider: 'inapp', externalId: 'dispatch-1' });
  });

  it('creates one immutable receipt batch and rejects ambiguous duplicates', async () => {
    const client = InappFactory.create({ maxBatchSize: 2 });
    const request = { recipient: 'member:member-1', providerTemplate: null, purpose: 'transactional', variables: {}, subject: null, body: '通知', idempotency: 'dispatch-1' } as const;
    await expect(client.sendBatch([request, { ...request, recipient: 'scope:mall-1', idempotency: 'dispatch-2' }])).resolves.toEqual([
      { provider: 'inapp', externalId: 'dispatch-1' },
      { provider: 'inapp', externalId: 'dispatch-2' },
    ]);
    await expect(client.sendBatch([request, request])).rejects.toThrow('INAPP_BATCH_IDEMPOTENCY_DUPLICATE');
  });

  it('honors task cancellation and deadline before writing a receipt', async () => {
    const client = InappFactory.create();
    const request = { recipient: 'member:member-1', providerTemplate: null, purpose: 'transactional' as const, variables: {}, subject: null, body: '通知', idempotency: 'dispatch-1' };
    const controller = new AbortController();
    controller.abort(new Error('TASK_CANCELLED'));
    expect(() => client.send({ ...request, signal: controller.signal })).toThrow('TASK_CANCELLED');
    expect(() => client.send({ ...request, deadline: Date.now() - 1 })).toThrow('INAPP_DELIVERY_DEADLINE_EXCEEDED');
  });
});
