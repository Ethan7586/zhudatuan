import { describe, expect, it } from 'vitest';
import { InappFactory } from './Factory';

describe('InappClient', () => {
  it('returns the business idempotency key as its canonical receipt', async () => {
    const client = InappFactory.create();
    await expect(client.send({ recipient: 'member-1', providerTemplate: null, variables: {}, subject: null, body: '通知', idempotency: 'dispatch-1' })).resolves.toEqual({ provider: 'inapp', externalId: 'dispatch-1' });
  });
});
