import { describe, expect, it, vi } from 'vitest';
import { InvitationsResolveHandler } from '../application/handler/InvitationsResolveHandler';

describe('InvitationsResolveHandler', () => {
  it('runs public rate preparation before the transactional lookup', async () => {
    const order: string[] = [];
    const resolver = {
      prepare: vi.fn(async () => {
        order.push('prepare');
        return { target: 'storefront' as const };
      }),
      execute: vi.fn(async (_request, transaction) => {
        order.push(transaction === writeTransaction ? 'commit' : 'wrong');
        return { status: 200, body: { kind: 'signin', target: 'storefront', expiresAt: new Date(0).toISOString(), requiresProof: false, requiresEnrollment: false } };
      }),
    };
    const handler = new InvitationsResolveHandler(resolver as never);
    const input = { body: { code: 'code', target: 'storefront' }, path: {}, query: {} } as never;
    const prepared = await handler.prepare(input, prepareContext() as never);
    const committed = await handler.commit(input, prepared, { ...prepareContext(), transaction: writeTransaction } as never);
    const finalized = await handler.finalize(input, committed.checkpoint, prepareContext() as never);

    expect(order).toEqual(['prepare', 'commit']);
    expect(finalized).toEqual(committed.response);
  });
});

const writeTransaction = Object.freeze({ mode: 'write' });

function prepareContext() {
  return {
    headers: {},
    rawBody: '',
    deadline: Date.now() + 1_000,
    signal: new AbortController().signal,
    publicActor: 'public:invitation',
    idempotencyKey: 'invitation:resolve',
    security: { kind: 'anonymous', channel: 'public', target: 'storefront', trace: 'trace:invitation' },
  };
}
