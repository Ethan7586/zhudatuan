import assert from 'node:assert/strict';
import { generateKeyPairSync } from 'node:crypto';
import type { ProviderCapability, ProviderManifest, ProviderPortName, ProviderPorts } from '@shop/contract';
import type { ProviderFactory } from '@shop/providercore';

export type ManifestFactory = (signature: string) => ProviderManifest;
export interface ProviderContractConnection {
  readonly endpoints: Readonly<Record<string, string>>;
  readonly healthOperation: string;
}

export async function providerContract(factory: ProviderFactory, createManifest: ManifestFactory, ports: readonly ProviderPortName[],
  connectionFixture: ProviderContractConnection = { endpoints: { health: '/health' }, healthOperation: 'health' }): Promise<void> {
  const signed = createManifest('release-signature');
  assert.equal(factory.id, signed.id);
  assert.equal(signed.priority, 1);
  assert.ok(signed.capabilities.length > 0);
  assert.equal(signed.secretRefs.length > 0, factory.transport === 'remote');
  assert.ok(signed.limits.maxConcurrency > 0);
  assert.ok(signed.limits.maxAttempts > 0);
  assert.throws(() => createManifest(''));
  const provider = factory.transport === 'remote'
    ? factory.create({ manifest: signed, connection: { id: `sandbox:${factory.id}`, baseUrl: 'https://sandbox.invalid', secret: contractSecret(signed.secretRefs),
      endpoints: connectionFixture.endpoints, healthOperation: connectionFixture.healthOperation, limits: signed.limits } })
    : factory.create({ manifest: signed, local: { ports: localPorts(), health: async () => true } });
  for (const port of expectedPorts(signed, ports)) assert.equal(provider.has(port), true, `${factory.id} does not expose ${port}`);
  assert.throws(() => factory.create({ manifest: { ...signed, contractVersion: 'wrong' }, ...(factory.transport === 'remote'
    ? { connection: { id: 'wrong', baseUrl: 'https://sandbox.invalid', secret: { token: 'x' }, endpoints: { health: '/health' }, healthOperation: 'health', limits: signed.limits } }
    : { local: { ports: localPorts(), health: async () => true } }) }), /PROVIDER_CONTRACT_MISMATCH/);
  await provider.start();
  if (factory.transport === 'local') assert.equal((await provider.health()).state, 'healthy');
  await provider.stop();
  assert.equal((await provider.health()).state, 'unavailable');
}

function contractSecret(secretRefs: ProviderManifest['secretRefs']): Readonly<Record<string, string>> {
  const { privateKey } = generateKeyPairSync('rsa', { modulusLength: 1024, privateKeyEncoding: { type: 'pkcs8', format: 'pem' }, publicKeyEncoding: { type: 'spki', format: 'pem' } });
  return Object.freeze(Object.fromEntries(secretRefs.map((secretRef) =>
    [secretRef, secretRef === 'privateKey' ? privateKey : `contract-${secretRef}`])));
}

const catalogPortByCapability: Partial<Record<ProviderCapability, ProviderPortName>> = Object.freeze({
  Catalog: 'catalog',
  Price: 'price',
  Inventory: 'stock',
});

function expectedPorts(manifest: ProviderManifest, fallback: readonly ProviderPortName[]): readonly ProviderPortName[] {
  const declared = manifest.capabilities.map((capability) => catalogPortByCapability[capability]);
  return declared.every((port): port is ProviderPortName => port !== undefined) ? declared : fallback;
}

function localPorts(): Partial<ProviderPorts> {
  return {
    catalog: { pullCatalog: async () => ({ records: [], errors: [], complete: true }) },
    stock: { pullStock: async () => ({ records: [] }) },
    order: { submit: async () => ({ externalReference: 'order', state: 'accepted', rawReference: 'raw' }) },
    tracking: { pullTracking: async () => ({ externalReference: 'order', milestones: [] }) },
    refund: { refund: async () => ({ externalReference: 'refund', state: 'accepted' }) },
    statement: { pullStatement: async () => ({ objectRef: 'object', sha256: '0'.repeat(64) }) },
  };
}
