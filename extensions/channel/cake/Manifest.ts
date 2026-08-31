import { PROVIDER_API_VERSION, type ProviderManifest, type UnsignedProviderManifest } from '@shop/contract';
import { STANDARD_PROVIDER_POLICY } from '@shop/providercore';

export const definition = Object.freeze({
  id: 'cake',
  kind: 'channel',
  version: '1.0.0',
  apiVersion: PROVIDER_API_VERSION,
  contractVersion: 'cake.v1',
  healthOperation: 'health',
  capabilities: ['Catalog', 'GeoStore', 'TimeSlot', 'Order', 'Cancel', 'Delivery', 'Refund', 'Statement', 'Webhook'],
  permissions: ['channel.cake.operate'],
  configSchema: 'provider.cake.v1',
  eventSubscriptions: ['ProviderWebhookReceived'],
  secretRefs: ['credential'],
  ...STANDARD_PROVIDER_POLICY,
  webhookContract: 'provider.cake.webhook.v1',
} as const satisfies UnsignedProviderManifest);

export function manifest(signature: string): ProviderManifest {
  if (!signature.trim()) throw new Error('CAKE_MANIFEST_SIGNATURE_MISSING');
  return Object.freeze({ ...definition, signature });
}
