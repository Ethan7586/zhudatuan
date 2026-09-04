import { PROVIDER_PORT_BY_CAPABILITY, type ProviderManifest, type UnsignedProviderManifest } from '@shop/contract';
import type { ProviderCatalog } from '../src/Catalog';
import type { ProviderFactory } from '../src/Factory';
import type { ProviderMapper } from '../src/Mapper';
import type { ProviderOperations } from '../src/PortFactory';
import type { ProviderError } from '../src/ProviderError';
import type { Webhook } from '../src/Webhook';

export function assertProviderCapabilities(manifest: UnsignedProviderManifest, operations: ProviderOperations | 'local'): void {
  if (!manifest.capabilities.length) throw new Error(`PROVIDER_CAPABILITIES_EMPTY:${manifest.id}`);
  if (operations === 'local') return;
  const uncovered = manifest.capabilities.filter((capability) => {
    const port = PROVIDER_PORT_BY_CAPABILITY[capability];
    if (!port) return true;
    return port === 'webhook' ? manifest.webhookContract === null : !operations[port];
  });
  if (uncovered.length) throw new Error(`PROVIDER_CAPABILITY_UNCOVERED:${manifest.id}:${uncovered.join(',')}`);
}

export function assertProviderCatalog(manifest: UnsignedProviderManifest, catalog: ProviderCatalog): void {
  assert(catalog.id === manifest.id, 'PROVIDER_CATALOG_ID_MISMATCH');
  assert(catalog.name.trim().length > 0 && catalog.business.trim().length > 0, 'PROVIDER_CATALOG_LABEL_MISSING');
  assert(catalog.clients.length > 0 && catalog.settings.length > 0 && catalog.help.trim().length > 0, 'PROVIDER_CATALOG_GUIDANCE_MISSING');
}

export function assertProviderFixture(mapper: ProviderMapper): void {
  const records = mapper.objects([{ externalId: 'fixture-sku', version: '1', payload: { name: '验收商品' } }], 'PROVIDER_FIXTURE_INVALID');
  assert(records.length === 1 && records[0]?.externalId === 'fixture-sku', 'PROVIDER_FIXTURE_MAPPING_FAILED');
}

export function assertProviderMappingFailure(mapper: ProviderMapper): void {
  assertThrows(() => mapper.objects([{ externalId: 'fixture-sku', version: '1' }], 'PROVIDER_MAPPING_INVALID'), 'PROVIDER_MAPPING_FAILURE_NOT_DETECTED');
}

export function assertProviderFailure(mapError: (error: unknown) => ProviderError, prefix: string, createManifest: (signature: string) => ProviderManifest): void {
  const mapped = mapError(new Error('provider failure'));
  assert(mapped.code.startsWith(prefix + '_'), 'PROVIDER_ERROR_PREFIX_INVALID');
  assert(/[\u3400-\u9fff]/u.test(mapped.message), 'PROVIDER_ERROR_NOT_LOCALIZED');
  assert(!mapped.message.includes('provider failure'), 'PROVIDER_ERROR_DETAIL_LEAKED');
  assertThrows(() => createManifest(''), 'PROVIDER_UNSIGNED_MANIFEST_ACCEPTED');
}

export interface ProviderQualityContract {
  readonly factory: ProviderFactory;
  readonly manifest: ProviderManifest;
  readonly mapper: ProviderMapper;
  readonly mapError: (error: unknown) => ProviderError;
  readonly webhook: typeof Webhook;
  readonly health: () => Promise<boolean>;
}

export async function assertProviderQuality(contract: ProviderQualityContract): Promise<void> {
  const { factory, manifest, mapper } = contract;
  assert(factory.id === manifest.id, 'PROVIDER_QUALITY_ID_MISMATCH');
  assert(new Set(factory.operations).size === factory.operations.length, 'PROVIDER_OPERATION_DUPLICATE');
  assert(!/BEGIN (?:RSA )?PRIVATE KEY|contract-secret|access-token/i.test(JSON.stringify(manifest)), 'PROVIDER_SECRET_LEAKED_IN_MANIFEST');
  const records = mapper.objects([{ externalId: 'quality', version: '1', payload: {} }], 'PROVIDER_MAPPING_INVALID');
  assert(records.length === 1, 'PROVIDER_MAPPING_EMPTY');
  assertThrows(() => mapper.objects([{ externalId: 'quality' }], 'PROVIDER_MAPPING_INVALID'), 'PROVIDER_MAPPING_ACCEPTED_INVALID');
  const mapped = contract.mapError(new Error('provider quality failure'));
  assert(mapped.code.startsWith(manifest.id.toUpperCase() + '_'), 'PROVIDER_FAILURE_MAPPING_INVALID');
  assert(/[\u3400-\u9fff]/u.test(mapped.message) && !mapped.message.includes('provider quality failure'), 'PROVIDER_FAILURE_MESSAGE_INVALID');

  let persisted = 0;
  const request = { providerId: manifest.id, externalId: 'quality-event', headers: {}, body: '{}', receivedAt: '2026-08-30T00:00:00.000Z', traceId: 'quality-trace' };
  const accepted = new contract.webhook({ verify: async () => true }, { persist: async (value) => { assert(value.sha256.length === 64, 'PROVIDER_WEBHOOK_DIGEST_INVALID'); persisted += 1; return 'accepted'; } });
  assert((await accepted.receive(request)) === 'accepted' && persisted === 1, 'PROVIDER_WEBHOOK_INGRESS_INVALID');
  const replayed = new contract.webhook({ verify: async () => true }, { persist: async (value) => { assert(value.sha256.length === 64, 'PROVIDER_WEBHOOK_DIGEST_INVALID'); return 'replayed'; } });
  assert((await replayed.receive(request)) === 'replayed' && persisted === 1, 'PROVIDER_WEBHOOK_REPLAY_INVALID');
  const rejected = new contract.webhook({ verify: async () => false }, { persist: async () => { persisted += 1; return 'accepted'; } });
  await assertRejects(() => rejected.receive(request), 'PROVIDER_WEBHOOK_SIGNATURE_INVALID');
  assert(persisted === 1, 'PROVIDER_WEBHOOK_REJECTION_PERSISTED');
  assert(await contract.health(), 'PROVIDER_HEALTH_PROBE_INVALID');
  assert(manifest.timeout.connectionMs > 0 && manifest.timeout.responseMs >= manifest.timeout.connectionMs && manifest.timeout.totalMs >= manifest.timeout.responseMs, 'PROVIDER_TIMEOUT_POLICY_INVALID');
  assert(manifest.retryPolicy.maxAttempts >= 1 && manifest.retryPolicy.maxAttempts <= 5, 'PROVIDER_RETRY_POLICY_INVALID');
  assert(manifest.circuitPolicy.failureThreshold > 0 && manifest.circuitPolicy.recoveryMs >= 100, 'PROVIDER_CIRCUIT_POLICY_INVALID');
  assertThrows(() => factory.create({ manifest: { ...manifest, contractVersion: manifest.contractVersion + '.invalid' } }), 'PROVIDER_FAILURE_CONTRACT_ACCEPTED');
}

function assert(value: unknown, code: string): asserts value { if (!value) throw new Error(code); }
function assertThrows(action: () => unknown, code: string): void { try { action(); } catch { return; } throw new Error(code); }
async function assertRejects(action: () => Promise<unknown>, code: string): Promise<void> { try { await action(); } catch (error) { if (error instanceof Error && error.message === code) return; throw error; } throw new Error(code + '_ACCEPTED'); }
