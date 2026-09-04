import { PROVIDER_API_VERSION,type ProviderManifest,type UnsignedProviderManifest } from '@shop/contract';
import { STANDARD_PROVIDER_LIMITS } from '@shop/providercore';

export const definition = Object.freeze({
  id: 'cake',
  kind: 'channel',
  priority: 1,
  version: '1.1.0',
  apiVersion: PROVIDER_API_VERSION,
  contractVersion: 'cake.v2',
  healthOperation: 'cake.categories',
  capabilities: ['Catalog', 'Price', 'Inventory'],
  permissions: ['channel.cake.operate'],
  configSchema: 'provider.cake.v2',
  eventSubscriptions: [],
  secretRefs: ['channelNo', 'channelKey'],
  limits: STANDARD_PROVIDER_LIMITS,
} as const satisfies UnsignedProviderManifest);

export function manifest(signature: string): ProviderManifest {
  if (!signature.trim()) throw new Error('CAKE_MANIFEST_SIGNATURE_MISSING');
  return Object.freeze({ ...definition, signature });
}
