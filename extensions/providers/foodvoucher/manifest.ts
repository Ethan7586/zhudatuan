import { PROVIDER_API_VERSION,type ProviderManifest,type UnsignedProviderManifest } from '@shop/contract';
import { STANDARD_PROVIDER_LIMITS } from '@shop/providercore';

export const definition = Object.freeze({
  id: 'foodvoucher',
  kind: 'channel',
  priority: 1,
<<<<<<< HEAD
<<<<<<< HEAD
  version: '1.1.0',
  apiVersion: PROVIDER_API_VERSION,
  contractVersion: 'foodvoucher.v2',
  healthOperation: 'health',
  capabilities: ['Catalog', 'Price'],
  permissions: ['channel.foodvoucher.operate'],
  configSchema: 'provider.foodvoucher.v2',
  eventSubscriptions: [],
  secretRefs: ['channelNo', 'channelKey'],
=======
  version: '1.0.0',
=======
  version: '1.1.0',
>>>>>>> 018b2a71 (chore(release): capture current production source)
  apiVersion: PROVIDER_API_VERSION,
  contractVersion: 'foodvoucher.v2',
  healthOperation: 'health',
  capabilities: ['Catalog', 'Price'],
  permissions: ['channel.foodvoucher.operate'],
<<<<<<< HEAD
  configSchema: 'provider.foodvoucher.v1',
  eventSubscriptions: ['ProviderWebhookReceived'],
  secretRefs: ['credential'],
>>>>>>> a7d9b2c8 (chore: establish zhudatuan main platform baseline)
=======
  configSchema: 'provider.foodvoucher.v2',
  eventSubscriptions: [],
  secretRefs: ['channelNo', 'channelKey'],
>>>>>>> 018b2a71 (chore(release): capture current production source)
  limits: STANDARD_PROVIDER_LIMITS,
} as const satisfies UnsignedProviderManifest);

export function manifest(signature: string): ProviderManifest {
  if (!signature.trim()) throw new Error('FOODVOUCHER_MANIFEST_SIGNATURE_MISSING');
  return Object.freeze({ ...definition, signature });
}
