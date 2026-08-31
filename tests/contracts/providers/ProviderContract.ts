import assert from 'node:assert/strict';
import { generateKeyPairSync } from 'node:crypto';
import type { ProviderManifest, ProviderPortName, ProviderPorts } from '@shop/contract';
import type { ProviderFactory } from '@shop/providercore';
<<<<<<< HEAD
<<<<<<< HEAD
import { CAKEUNCLE_MEAL_BRANDS, CAKEUNCLE_PHYSICAL_ENDPOINTS, CAKEUNCLE_VOUCHER_ENDPOINTS } from '@shop/vendorcakeuncle';
=======
>>>>>>> a7d9b2c8 (chore: establish zhudatuan main platform baseline)
=======
import { CAKEUNCLE_MEAL_BRANDS, CAKEUNCLE_PHYSICAL_ENDPOINTS, CAKEUNCLE_VOUCHER_ENDPOINTS } from '@shop/vendorcakeuncle';
>>>>>>> 018b2a71 (chore(release): capture current production source)

export type ManifestFactory = (signature: string) => ProviderManifest;

export async function providerContract(factory: ProviderFactory, createManifest: ManifestFactory, ports: readonly ProviderPortName[]): Promise<void> {
  const signed = createManifest('release-signature');
  assert.equal(factory.id, signed.id);
  assert.equal(signed.priority, 1);
  assert.ok(signed.capabilities.length > 0);
  assert.equal(signed.secretRefs.length > 0, factory.transport === 'remote');
  assert.ok(signed.limits.maxConcurrency > 0);
  assert.ok(signed.limits.maxAttempts > 0);
  assert.throws(() => createManifest(''));
<<<<<<< HEAD
<<<<<<< HEAD
  const connection = contractConnection(factory.id, signed.healthOperation, signed.limits);
  const provider = factory.transport === 'remote' ? factory.create({ manifest: signed, connection }) : factory.create({ manifest: signed, local: { ports: localPorts(), health: async () => true } });
  for (const port of ports) assert.equal(provider.has(port), true, `${factory.id} does not expose ${port}`);
  assert.throws(
    () =>
      factory.create({
        manifest: { ...signed, contractVersion: 'wrong' },
        ...(factory.transport === 'remote'
          ? { connection: { id: 'wrong', baseUrl: 'https://sandbox.invalid', secret: { token: 'x' }, endpoints: { health: '/health' }, healthOperation: 'health', limits: signed.limits } }
          : { local: { ports: localPorts(), health: async () => true } }),
      }),
    /PROVIDER_CONTRACT_MISMATCH/
  );
=======
  const provider = factory.transport === 'remote'
    ? factory.create({ manifest: signed, connection: { id: `sandbox:${factory.id}`, baseUrl: 'https://sandbox.invalid', secret: contractSecret(),
      endpoints: { health: '/health' }, healthOperation: 'health', limits: signed.limits } })
    : factory.create({ manifest: signed, local: { ports: localPorts(), health: async () => true } });
  for (const port of ports) assert.equal(provider.has(port), true, `${factory.id} does not expose ${port}`);
  assert.throws(() => factory.create({ manifest: { ...signed, contractVersion: 'wrong' }, ...(factory.transport === 'remote'
    ? { connection: { id: 'wrong', baseUrl: 'https://sandbox.invalid', secret: { token: 'x' }, endpoints: { health: '/health' }, healthOperation: 'health', limits: signed.limits } }
    : { local: { ports: localPorts(), health: async () => true } }) }), /PROVIDER_CONTRACT_MISMATCH/);
>>>>>>> a7d9b2c8 (chore: establish zhudatuan main platform baseline)
=======
  const connection = contractConnection(factory.id, signed.healthOperation, signed.limits);
  const provider = factory.transport === 'remote' ? factory.create({ manifest: signed, connection }) : factory.create({ manifest: signed, local: { ports: localPorts(), health: async () => true } });
  for (const port of ports) assert.equal(provider.has(port), true, `${factory.id} does not expose ${port}`);
  assert.throws(
    () =>
      factory.create({
        manifest: { ...signed, contractVersion: 'wrong' },
        ...(factory.transport === 'remote'
          ? { connection: { id: 'wrong', baseUrl: 'https://sandbox.invalid', secret: { token: 'x' }, endpoints: { health: '/health' }, healthOperation: 'health', limits: signed.limits } }
          : { local: { ports: localPorts(), health: async () => true } }),
      }),
    /PROVIDER_CONTRACT_MISMATCH/
  );
>>>>>>> 018b2a71 (chore(release): capture current production source)
  await provider.start();
  if (factory.transport === 'local') assert.equal((await provider.health()).state, 'healthy');
  await provider.stop();
  assert.equal((await provider.health()).state, 'unavailable');
}

<<<<<<< HEAD
<<<<<<< HEAD
=======
>>>>>>> 018b2a71 (chore(release): capture current production source)
function contractConnection(id: string, defaultHealth: string, limits: ProviderManifest['limits']) {
  const configured = {
    cake: { healthOperation: 'cake.categories', endpoints: { 'cake.categories': CAKEUNCLE_PHYSICAL_ENDPOINTS.categories, 'cake.category.1': CAKEUNCLE_PHYSICAL_ENDPOINTS.products } },
    flower: { healthOperation: 'flower.categories', endpoints: { 'flower.categories': CAKEUNCLE_PHYSICAL_ENDPOINTS.categories, 'flower.category.1': CAKEUNCLE_PHYSICAL_ENDPOINTS.products } },
    foodvoucher: { healthOperation: defaultHealth, endpoints: { [defaultHealth]: CAKEUNCLE_VOUCHER_ENDPOINTS.products } },
    meal: { healthOperation: defaultHealth, endpoints: { [defaultHealth]: CAKEUNCLE_MEAL_BRANDS.sbk.menu, 'meal.menu.sbk.contract-store': CAKEUNCLE_MEAL_BRANDS.sbk.menu } },
  }[id] ?? { healthOperation: defaultHealth, endpoints: { [defaultHealth]: '/health' } };
  return { id: `sandbox:${id}`, baseUrl: 'https://sandbox.invalid', secret: contractSecret(), limits, ...configured };
}

<<<<<<< HEAD
function contractSecret(): Readonly<Record<string, string>> {
  const { privateKey } = generateKeyPairSync('rsa', { modulusLength: 1024, privateKeyEncoding: { type: 'pkcs8', format: 'pem' }, publicKeyEncoding: { type: 'spki', format: 'pem' } });
  return {
    keyId: 'contract-key',
    secret: 'contract-secret',
    privateKey,
    channelNo: 'contract-channel',
    channelKey: 'contract-channel-key',
    userId: 'contract-user',
  };
=======
function contractSecret(): Readonly<Record<string, string>> {
  const { privateKey } = generateKeyPairSync('rsa', { modulusLength: 1024, privateKeyEncoding: { type: 'pkcs8', format: 'pem' }, publicKeyEncoding: { type: 'spki', format: 'pem' } });
  return { keyId: 'contract-key', secret: 'contract-secret', privateKey };
>>>>>>> a7d9b2c8 (chore: establish zhudatuan main platform baseline)
=======
function contractSecret(): Readonly<Record<string, string>> {
  const { privateKey } = generateKeyPairSync('rsa', { modulusLength: 1024, privateKeyEncoding: { type: 'pkcs8', format: 'pem' }, publicKeyEncoding: { type: 'spki', format: 'pem' } });
  return {
    keyId: 'contract-key',
    secret: 'contract-secret',
    privateKey,
    channelNo: 'contract-channel',
    channelKey: 'contract-channel-key',
    userId: 'contract-user',
  };
>>>>>>> 018b2a71 (chore(release): capture current production source)
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
