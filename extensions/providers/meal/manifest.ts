import { PROVIDER_API_VERSION,type ProviderManifest,type UnsignedProviderManifest } from '@shop/contract';
import { STANDARD_PROVIDER_LIMITS } from '@shop/providercore';

export const definition = Object.freeze({
  id: 'meal',
  kind: 'channel',
  priority: 1,
<<<<<<< HEAD
  version: '1.1.0',
  apiVersion: PROVIDER_API_VERSION,
  contractVersion: 'meal.v2',
  healthOperation: 'health',
  capabilities: ['Catalog', 'Price'],
  permissions: ['channel.meal.operate'],
  configSchema: 'provider.meal.v2',
  eventSubscriptions: [],
  secretRefs: ['channelNo', 'channelKey'],
=======
  version: '1.0.0',
  apiVersion: PROVIDER_API_VERSION,
  contractVersion: 'meal.v1',
  healthOperation: 'health',
  capabilities: ['Brand', 'Store', 'Menu', 'Option', 'Price', 'Inventory', 'Order', 'Pickup', 'Cancel', 'Refund', 'Statement', 'Verify', 'Webhook'],
  permissions: ['channel.meal.operate'],
  configSchema: 'provider.meal.v1',
  eventSubscriptions: ['ProviderWebhookReceived'],
  secretRefs: ['credential'],
>>>>>>> a7d9b2c8 (chore: establish zhudatuan main platform baseline)
  limits: STANDARD_PROVIDER_LIMITS,
} as const satisfies UnsignedProviderManifest);

export function manifest(signature: string): ProviderManifest {
  if (!signature.trim()) throw new Error('MEAL_MANIFEST_SIGNATURE_MISSING');
  return Object.freeze({ ...definition, signature });
}
