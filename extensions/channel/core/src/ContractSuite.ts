import type { ChannelProvider, ProviderManifest, UnsignedProviderManifest } from '@shop/contract';
import type { ProviderError } from './ErrorMap';
import type { ProviderFactory } from './Factory';
import type { ProviderMapper } from './Mapper';
import type { ProviderOperations } from './PortFactory';
import type { Webhook } from './Webhook';

const capabilityPorts = Object.freeze({
  Catalog: 'catalog',
  Brand: 'catalog',
  Store: 'catalog',
  Menu: 'catalog',
  Option: 'catalog',
  Cinema: 'catalog',
  Show: 'catalog',
  GeoStore: 'catalog',
  Price: 'price',
  Inventory: 'stock',
  GeoStock: 'stock',
  TimeSlot: 'stock',
  GeoDelivery: 'stock',
  Order: 'order',
  Issue: 'order',
  DirectCharge: 'order',
  SeatLock: 'order',
  Cancel: 'cancel',
  Void: 'cancel',
  Return: 'return',
  Refund: 'refund',
  Extend: 'refund',
  Substitute: 'refund',
  Logistics: 'tracking',
  Delivery: 'tracking',
  Shipment: 'tracking',
  Pickup: 'tracking',
  Query: 'tracking',
  Statement: 'statement',
  Verify: 'verification',
  Bind: 'verification',
  Webhook: 'webhook',
} as const satisfies Readonly<Record<string, keyof ProviderOperations | 'webhook'>>);

export function assertProviderCapabilities(manifest: UnsignedProviderManifest, operations: ProviderOperations | 'local'): void {
  if (!manifest.capabilities.length) throw new Error(`PROVIDER_CAPABILITIES_EMPTY:${manifest.id}`);
  if (operations === 'local') return;
  const uncovered = manifest.capabilities.filter((capability) => {
    const port = capabilityPorts[capability as keyof typeof capabilityPorts];
    if (!port) return true;
    return port === 'webhook' ? manifest.webhookContract === null : !operations[port];
  });
  if (uncovered.length) throw new Error(`PROVIDER_CAPABILITY_UNCOVERED:${manifest.id}:${uncovered.join(',')}`);
}

export function assertInstalledProvider(provider: ChannelProvider): void {
  const uncovered = provider.manifest.capabilities.filter((capability) => {
    const port = capabilityPorts[capability as keyof typeof capabilityPorts];
    return !port || !provider.has(port);
  });
  if (uncovered.length) throw new Error(`PROVIDER_CONTRACT_SUITE_FAILED:${provider.manifest.id}:${uncovered.join(',')}`);
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
  const records = mapper.objects([{ externalId: 'quality', version: '1', payload: {} }], 'PROVIDER_MAPPING_INVALID');
  assert(records.length === 1, 'PROVIDER_MAPPING_EMPTY');
  assertThrows(() => mapper.objects([{ externalId: 'quality' }], 'PROVIDER_MAPPING_INVALID'), 'PROVIDER_MAPPING_ACCEPTED_INVALID');
  const mapped = contract.mapError(new Error('provider quality failure'));
  assert(mapped.code.startsWith(manifest.id.toUpperCase() + '_'), 'PROVIDER_FAILURE_MAPPING_INVALID');

  let persisted = 0;
  const request = { providerId: manifest.id, externalId: 'quality-event', headers: {}, body: '{}', receivedAt: '2026-08-30T00:00:00.000Z', traceId: 'quality-trace' };
  const accepted = new contract.webhook(
    { verify: async () => true },
    {
      persist: async (value) => {
        assert(value.sha256.length === 64, 'PROVIDER_WEBHOOK_DIGEST_INVALID');
        persisted += 1;
        return 'accepted';
      },
    }
  );
  assert((await accepted.receive(request)) === 'accepted' && persisted === 1, 'PROVIDER_WEBHOOK_INGRESS_INVALID');
  const rejected = new contract.webhook(
    { verify: async () => false },
    {
      persist: async () => {
        persisted += 1;
        return 'accepted';
      },
    }
  );
  await assertRejects(() => rejected.receive(request), 'PROVIDER_WEBHOOK_SIGNATURE_INVALID');
  assert(persisted === 1, 'PROVIDER_WEBHOOK_REJECTION_PERSISTED');
  assert(await contract.health(), 'PROVIDER_HEALTH_PROBE_INVALID');

  assert(manifest.timeout.connectionMs > 0 && manifest.timeout.responseMs >= manifest.timeout.connectionMs && manifest.timeout.totalMs >= manifest.timeout.responseMs, 'PROVIDER_TIMEOUT_POLICY_INVALID');
  assert(manifest.retryPolicy.maxAttempts >= 1 && manifest.retryPolicy.maxAttempts <= 5, 'PROVIDER_RETRY_POLICY_INVALID');
  assert(manifest.circuitPolicy.failureThreshold > 0 && manifest.circuitPolicy.recoveryMs >= 100, 'PROVIDER_CIRCUIT_POLICY_INVALID');
  assertThrows(() => factory.create({ manifest: { ...manifest, contractVersion: manifest.contractVersion + '.invalid' } }), 'PROVIDER_FAILURE_CONTRACT_ACCEPTED');
}

function assert(value: unknown, code: string): asserts value {
  if (!value) throw new Error(code);
}

function assertThrows(action: () => unknown, code: string): void {
  try {
    action();
  } catch {
    return;
  }
  throw new Error(code);
}

async function assertRejects(action: () => Promise<unknown>, code: string): Promise<void> {
  try {
    await action();
  } catch (error) {
    if (error instanceof Error && error.message === code) return;
    throw error;
  }
  throw new Error(code + '_ACCEPTED');
}
