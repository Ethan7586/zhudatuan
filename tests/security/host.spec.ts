import assert from 'node:assert/strict';
import { test } from 'node:test';
import { BootstrapQuery, canonicalHost } from '../../services/commerce/src/modules/navigation/application/service/BootstrapQuery';
import { trustedPeerAddress } from '../../services/commerce/src/foundation/interface/NodeServer';

test('storefront host binding rejects forged Host and untrusted X-Forwarded-Host', async () => {
  assert.equal(canonicalHost({ host: 'Store.Example:443', 'x-forwarded-host': 'store.example' }), 'store.example');
  assert.throws(() => canonicalHost({ host: 'store.example', 'x-forwarded-host': 'evil.example' }), /STOREFRONT_FORWARDED_HOST_UNTRUSTED/);
  assert.throws(() => canonicalHost({ host: 'store.example@evil.example' }), /STOREFRONT_HOST_INVALID/);

  let resolved = '';
  const query = new BootstrapQuery({
    experience: {
      resolveHost: async (_transaction: unknown, host: string) => {
        resolved = host;
        throw new Error('STOREFRONT_HOST_NOT_BOUND');
      },
    },
  } as never);
  await assert.rejects(
    query.execute(
      {} as never,
      {
        operation: 'storefront.bootstrap.read',
        headers: { host: 'evil.example' },
        security: { kind: 'anonymous', channel: 'public', target: 'storefront', trace: 'trace:host' },
        transaction: {},
        deadline: Date.now() + 1_000,
        signal: AbortSignal.timeout(1_000),
      } as never
    ),
    /STOREFRONT_HOST_NOT_BOUND/
  );
  assert.equal(resolved, 'evil.example');
});

test('forwarded client identity is accepted only from the local reverse proxy', () => {
  assert.equal(trustedPeerAddress('203.0.113.8', '127.0.0.1'), '203.0.113.8');
  assert.equal(trustedPeerAddress('203.0.113.8', '198.51.100.2'), '198.51.100.2');
  assert.equal(trustedPeerAddress('203.0.113.8, 198.51.100.2', '127.0.0.1'), '127.0.0.1');
});
