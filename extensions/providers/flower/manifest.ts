import { PROVIDER_API_VERSION,type ProviderManifest,type UnsignedProviderManifest } from '@shop/contract';
import { STANDARD_PROVIDER_LIMITS } from '@shop/providercore';

export const definition = Object.freeze({
  id: 'flower',
  kind: 'channel',
  priority: 1,
<<<<<<< HEAD
<<<<<<< HEAD
<<<<<<< HEAD
  version: '1.1.0',
  apiVersion: PROVIDER_API_VERSION,
  contractVersion: 'flower.v2',
  healthOperation: 'flower.categories',
  capabilities: ['Catalog', 'Price', 'Inventory'],
  permissions: ['channel.flower.operate'],
  configSchema: 'provider.flower.v2',
  eventSubscriptions: [],
  secretRefs: ['channelNo', 'channelKey'],
=======
  version: '1.0.0',
=======
  version: '1.1.0',
>>>>>>> 018b2a71 (chore(release): capture current production source)
  apiVersion: PROVIDER_API_VERSION,
  contractVersion: 'flower.v2',
  healthOperation: 'flower.categories',
  capabilities: ['Catalog', 'Price', 'Inventory'],
  permissions: ['channel.flower.operate'],
<<<<<<< HEAD
  configSchema: 'provider.flower.v1',
  eventSubscriptions: ['ProviderWebhookReceived'],
  secretRefs: ['credential'],
>>>>>>> a7d9b2c8 (chore: establish zhudatuan main platform baseline)
=======
  configSchema: 'provider.flower.v2',
  eventSubscriptions: [],
  secretRefs: ['channelNo', 'channelKey'],
>>>>>>> 018b2a71 (chore(release): capture current production source)
=======
  version: '1.0.0',
  apiVersion: PROVIDER_API_VERSION,
  contractVersion: 'flower.v1',
  healthOperation: 'health',
  capabilities: ['Catalog', 'GeoDelivery', 'TimeSlot', 'Order', 'Substitute', 'Cancel', 'Delivery', 'Refund', 'Statement', 'Webhook'],
  permissions: ['channel.flower.operate'],
  configSchema: 'provider.flower.v1',
  eventSubscriptions: ['ProviderWebhookReceived'],
  secretRefs: ['credential'],
>>>>>>> a7d9b2c8 (chore: establish zhudatuan main platform baseline)
  limits: STANDARD_PROVIDER_LIMITS,
} as const satisfies UnsignedProviderManifest);

export function manifest(signature: string): ProviderManifest {
  if (!signature.trim()) throw new Error('FLOWER_MANIFEST_SIGNATURE_MISSING');
  return Object.freeze({ ...definition, signature });
}
