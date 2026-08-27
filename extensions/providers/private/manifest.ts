import { PROVIDER_API_VERSION,type ProviderManifest,type UnsignedProviderManifest } from '@shop/contract';
import { STANDARD_PROVIDER_LIMITS } from '@shop/providercore';

export const definition = Object.freeze({
  id: 'private',
  kind: 'channel',
  priority: 1,
  version: '1.0.0',
  apiVersion: PROVIDER_API_VERSION,
  contractVersion: 'private.v1',
  healthOperation: 'local',
  capabilities: ['Catalog', 'Inventory', 'Order', 'Shipment', 'Return', 'Refund', 'Statement'],
  permissions: ['channel.private.operate'],
  configSchema: 'provider.private.v1',
  eventSubscriptions: [],
  secretRefs: [],
  limits: STANDARD_PROVIDER_LIMITS,
} as const satisfies UnsignedProviderManifest);

export function manifest(signature: string): ProviderManifest {
  if (!signature.trim()) throw new Error('PRIVATE_MANIFEST_SIGNATURE_MISSING');
  return Object.freeze({ ...definition, signature });
}
