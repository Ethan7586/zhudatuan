import assert from 'node:assert/strict';
import { test } from 'node:test';
import { BootstrapQuery } from '../../services/commerce/src/modules/navigation/application/service/BootstrapQuery';
import { trustedPeerAddress } from '../../services/commerce/src/platform/http/NodeServer';

test('storefront rejects missing, reserved and noncanonical handles before lookup', async () => {
  let calls = 0;
  const query = new BootstrapQuery({
    experience: {
      resolveEntry: async () => {
        calls += 1;
        throw new Error('LOOKUP_MUST_NOT_RUN');
      },
    },
  } as never);
  for (const handle of [undefined, 'Admin', 'api', 'javascript:', '%2fadmin', '%5cadmin', '%252fadmin', 'mall one', 'mall-one?accessToken=secret', 'mаll-one']) {
    await assert.rejects(query.execute({} as never, context(handle)), (cause: unknown) => errorCode(cause) === 'STOREFRONT_HANDLE_INVALID');
  }
  assert.equal(calls, 0);
});

test('host and forwarded host never participate in storefront selection', async () => {
  let selected = '';
  const query = new BootstrapQuery({
    experience: {
      resolveEntry: async (_transaction: unknown, handle: string) => {
        selected = handle;
        return entry('mall:one');
      },
      published: async () => ({ document: {}, version: 'version:one', asOf: '2026-09-01T00:00:00.000Z' }),
    },
    identity: { resolve: () => ({ state: 'anonymous', membership: null, version: 1 }) },
    navigation: { featureFlags: new Set(), read: () => ({ nodes: [], version: '1' }) },
    capability: { read: async () => [{ scope: 'mall:one', capabilities: new Set(), version: 0 }] },
  } as never);
  const value = context('mall-other') as unknown as { headers: Record<string, string> };
  value.headers.host = 'attacker.example';
  value.headers['x-forwarded-host'] = 'mall-victim.yengze.press';
  await query.execute({} as never, value as never);
  assert.equal(selected, 'mall-other');
});

test('authenticated cross-mall scan fails closed without anonymous downgrade', async () => {
  const query = new BootstrapQuery({
    experience: { resolveEntry: async () => entry('mall:other') },
    identity: { resolve: () => ({ state: 'member', membership: 'membership:one', version: 1 }) },
    membership: { member: async () => 'member:one' },
    member: { summary: async () => ({ id: 'member:one', displayName: '员工' }) },
  } as never);
  await assert.rejects(query.execute({} as never, sessionContext()), (cause: unknown) => errorCode(cause) === 'STOREFRONT_MEMBERSHIP_MALL_MISMATCH');
});

test('forwarded client identity is accepted only from the local reverse proxy', () => {
  assert.equal(trustedPeerAddress('203.0.113.8', '127.0.0.1'), '203.0.113.8');
  assert.equal(trustedPeerAddress('203.0.113.8', '198.51.100.2'), '198.51.100.2');
  assert.equal(trustedPeerAddress('203.0.113.8, 198.51.100.2', '127.0.0.1'), '127.0.0.1');
});

function context(handle: string | undefined) {
  return {
    operation: 'storefront.bootstrap.read',
    headers: handle === undefined ? {} : { 'x-storefront-handle': handle },
    security: { kind: 'anonymous', channel: 'public', target: 'storefront', trace: 'trace:entry' },
    transaction: {},
    deadline: Date.now() + 1_000,
    signal: AbortSignal.timeout(1_000),
  } as never;
}

function sessionContext() {
  return {
    ...context('mall-other'),
    security: { kind: 'session', access: { organization: 'mall:current', actor: { id: 'actor:one', target: 'storefront' } } },
  } as never;
}

function entry(mall: string) {
  return {
    application: 'application:one',
    handle: 'mall-other',
    url: 'https://yengze.press/s/mall-other',
    mall,
    pool: 'pool:one',
    release: 'release:one',
    version: 'version:one',
    tenant: 'tenant:one',
    contentHash: 'hash:one',
    objectKey: 'experience/mall-other/hash.json',
  };
}

function errorCode(cause: unknown): string | undefined {
  return cause !== null && typeof cause === 'object' && 'code' in cause ? String(Reflect.get(cause, 'code')) : undefined;
}
