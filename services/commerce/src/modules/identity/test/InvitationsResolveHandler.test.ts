import { describe, expect, it, vi } from 'vitest';
import { InvitationsResolveHandler } from '../application/handler/InvitationsResolveHandler';

describe('InvitationsResolveHandler', () => {
  it('loads the invitation before preparation and commits in its verified scope', async () => {
    const order: string[] = [];
    const resolver = {
      load: vi.fn(async () => {
        order.push('load');
        return { invitation: { state: { organization: 'mall-zhudatuan' } } };
      }),
      prepare: vi.fn(async (_request, loaded) => {
        order.push('prepare');
        return { loaded };
      }),
      commit: vi.fn(async (_request, transaction) => {
        order.push(transaction === writeTransaction ? 'commit' : 'wrong');
        return { status: 200, body: { kind: 'enrollment', enrollment: { id: 'claim:one', target: 'storefront', expiresAt: new Date(0).toISOString() } } };
      }),
      finalize: vi.fn((_request, result) => result),
      discard: vi.fn(async () => undefined),
    };
    const handler = new InvitationsResolveHandler(resolver as never);
    const input = { body: { code: 'code', target: 'storefront' }, path: {}, query: {} } as never;
    const loaded = await handler.load(input, { ...prepareContext(), transaction: readTransaction } as never);
    const prepared = await handler.prepare(input, prepareContext() as never, loaded);
    const committed = await handler.commit(input, prepared, { ...prepareContext(), transaction: writeTransaction } as never);
    const finalized = await handler.finalize(input, committed.checkpoint, prepareContext() as never);

    expect(order).toEqual(['load', 'prepare', 'commit']);
    expect(finalized).toEqual(committed.response);
  });
});

const writeTransaction = Object.freeze({ mode: 'write' });
const readTransaction = Object.freeze({ mode: 'read' });

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
