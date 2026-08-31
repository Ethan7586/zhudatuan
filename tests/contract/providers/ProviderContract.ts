import assert from 'node:assert/strict';
import { generateKeyPairSync } from 'node:crypto';
import type { ProviderManifest, ProviderPortName, ProviderPorts } from '@shop/contract';
import { providerLimit, type ProviderFactory } from '@shop/providercore';

export type ManifestFactory = (signature: string) => ProviderManifest;

export async function providerContract(factory: ProviderFactory, createManifest: ManifestFactory, ports: readonly ProviderPortName[]): Promise<void> {
  const signed = createManifest('release-signature');
  assert.equal(factory.id, signed.id);
  assert.ok(signed.capabilities.length > 0);
  assert.equal(signed.secretRefs.length > 0, factory.transport === 'remote');
  const limits = providerLimit(signed);
  assert.ok(limits.maxConcurrency > 0);
  assert.ok(limits.maxAttempts > 0);
  assert.throws(() => createManifest(''));
  const provider =
    factory.transport === 'remote'
      ? factory.create({ manifest: signed, connection: { id: `sandbox:${factory.id}`, baseUrl: 'https://sandbox.invalid', secret: contractSecret(), endpoints: endpoints(factory), healthOperation: 'health', limits } })
      : factory.create({ manifest: signed, local: { ports: localPorts(), health: async () => true } });
  for (const port of ports) assert.equal(provider.has(port), true, `${factory.id} does not expose ${port}`);
  assert.throws(
    () =>
      factory.create({
        manifest: { ...signed, contractVersion: 'wrong' },
        ...(factory.transport === 'remote'
          ? { connection: { id: 'wrong', baseUrl: 'https://sandbox.invalid', secret: { token: 'x' }, endpoints: endpoints(factory), healthOperation: 'health', limits } }
          : { local: { ports: localPorts(), health: async () => true } }),
      }),
    /PROVIDER_CONTRACT_MISMATCH/
  );
  await provider.start();
  if (factory.transport === 'local') assert.equal((await provider.health()).state, 'healthy');
  await provider.stop();
  assert.equal((await provider.health()).state, 'unavailable');
}

function contractSecret(): Readonly<Record<string, string>> {
  const { privateKey } = generateKeyPairSync('rsa', { modulusLength: 1024, privateKeyEncoding: { type: 'pkcs8', format: 'pem' }, publicKeyEncoding: { type: 'spki', format: 'pem' } });
  return { keyId: 'contract-key', secret: 'contract-secret', privateKey };
}

function endpoints(factory: ProviderFactory): Readonly<Record<string, string>> {
  return Object.freeze(Object.fromEntries(['health', ...factory.operations].map((operation, index) => [operation, `/operation/${index}`])));
}

function localPorts(): Partial<ProviderPorts> {
  return {
    catalog: { pullCatalog: async () => ({ records: [], errors: [], complete: true }) },
    stock: { pullStock: async () => ({ records: [] }) },
    order: { submit: async () => ({ externalReference: 'order', state: 'accepted', rawReference: 'raw' }) },
    tracking: { pullTracking: async () => ({ externalReference: 'order', milestones: [] }) },
    return: { authorize: async () => ({ externalReference: 'return', state: 'authorized', instruction: { method: 'pickup' } }) },
    refund: { refund: async () => ({ externalReference: 'refund', state: 'accepted' }) },
    statement: { pullStatement: async () => ({ objectRef: 'object', sha256: '0'.repeat(64) }) },
  };
}
