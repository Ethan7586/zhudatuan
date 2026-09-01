import assert from 'node:assert/strict';
import { test } from 'node:test';
import { BootstrapQuery, canonicalHost } from '../../services/commerce/src/modules/navigation/application/service/BootstrapQuery';
import { result as databaseResult, withReadTransaction } from '../../services/commerce/src/test/TransactionFixture';

test('storefront bootstrap resolves the trusted host and returns one coherent anonymous snapshot', async () => {
  const calls: string[] = [];
  const query = new BootstrapQuery({
    identity: { resolve: () => ({ state: 'anonymous', member: null, membership: null, scope: null, version: 0 }) },
    navigation: { storefront: () => ({ items: [{ id: 'storefront.home', title: '首页', icon: 'home', route: '/', order: 1 }], version: 'navigation:1' }) },
    member: {
      summary: async () => {
        throw new Error('ANONYMOUS_MEMBER_LOOKUP_FORBIDDEN');
      },
    },
    benefit: {
      summary: async () => {
        throw new Error('ANONYMOUS_BENEFIT_LOOKUP_FORBIDDEN');
      },
    },
    order: {
      summary: async () => {
        throw new Error('ANONYMOUS_ORDER_LOOKUP_FORBIDDEN');
      },
    },
    experience: {
      resolveHost: async (_context, host) => {
        calls.push(`host:${host}`);
        return { application: 'application:one', mall: 'mall:one', pool: 'pool:one', release: 'release:one', version: 'binding:1', tenant: 'tenant:one' };
      },
      published: async () => ({ document: { sections: [] }, version: 'experience:1', asOf: '2026-08-31T00:00:00.000Z' }),
    },
  } as never);
  const response = await withReadTransaction(
    async () => databaseResult([]),
    (transaction) => query.execute({} as never, context(transaction, { host: 'Mall.Example:443', 'x-forwarded-host': 'mall.example' }))
  );
  const body = response.body as Record<string, any>;
  assert.equal(response.status, 200);
  assert.equal(response.headers?.['cache-control'], 'public,max-age=30');
  assert.equal(body.state, 'complete');
  assert.equal(body.binding.mall, 'mall:one');
  assert.equal(body.identity.data.state, 'anonymous');
  assert.equal(body.benefit.state, 'unavailable');
  assert.equal(body.orders.state, 'unavailable');
  assert.deepEqual(calls, ['host:mall.example']);
});

test('storefront bootstrap rejects forwarded-host confusion before a binding lookup', () => {
  assert.throws(() => canonicalHost({ host: 'mall.example', 'x-forwarded-host': 'attacker.example' }), /STOREFRONT_FORWARDED_HOST_UNTRUSTED/);
  assert.throws(() => canonicalHost({ host: 'mall.example/path' }), /STOREFRONT_HOST_INVALID/);
});

function context(transaction: unknown, headers: Readonly<Record<string, string>>) {
  return {
    requestId: 'request:bootstrap',
    traceId: 'trace:bootstrap',
    operation: 'storefront.bootstrap.read',
    transaction,
    headers,
    rawBody: '',
    deadline: Date.now() + 1_000,
    signal: new AbortController().signal,
    security: { kind: 'anonymous', channel: 'public', target: 'storefront', trace: 'trace:bootstrap' },
    publicActor: 'public:bootstrap',
  } as never;
}
