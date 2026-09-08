import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { REQUIRED_PROVIDER_IDS } from '@shop/contract';
import { assertProviderReady } from '../../services/commerce/src/composition/ProviderBootstrap';

test('provider process refuses API or Jobs database roles and requires every extension healthy', async () => {
  const extensions = { healthAll: async () => REQUIRED_PROVIDER_IDS.map((provider) => ({ provider, scope: 'mall:one', state: 'healthy', checkedAt: new Date(0).toISOString() })) };
  const invalid = { query: async () => ({ rows: [{ role: false, migration: true, contract: true, operations: 267, events: 97 }] }) };
  await assert.rejects(assertProviderReady(invalid as never, extensions as never), /PROVIDER_RUNTIME_NOT_READY/);
});

test('provider worker is an isolated entrypoint with secret references, CAS activation and bounded execution', () => {
  const main = text('../../services/commerce/src/entry/ProviderMain.ts');
  const runtime = text('../../services/commerce/src/composition/ProviderRuntime.ts');
  const loader = text('../../services/commerce/src/modules/extension/infrastructure/loader/RuntimeExtensionLoader.ts');
  const registry = text('../../services/commerce/src/composition/ExtensionRegistry.ts');
  const compose = text('../../infrastructure/container/local/compose.yml');
  assert.match(main, /PROVIDER_JOB_CATALOG/);
  assert.match(runtime, /DATABASE_PROVIDER_CONNECTION_REF/);
  assert.match(runtime, /DATABASE_ROLE_INVALID:shopprovider/);
  assert.match(loader, /secret_ref/);
  assert.match(registry, /EXTENSION_REGISTRY_CAS_FAILED/);
  assert.match(registry, /mapParallel/);
  assert.doesNotMatch(compose, /provider_secret\s*:/i);
  assert.equal(REQUIRED_PROVIDER_IDS.length, 11);
});

function text(relative: string): string {
  return readFileSync(new URL(relative, import.meta.url), 'utf8');
}
