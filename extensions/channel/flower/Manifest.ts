import { PROVIDER_API_VERSION, type ProviderManifest, type UnsignedProviderManifest } from '@shop/contract';
import { STANDARD_PROVIDER_POLICY } from '@shop/providercore';

export const definition = Object.freeze({
  id: 'flower',
  kind: 'channel',
  version: '1.0.0',
  apiVersion: PROVIDER_API_VERSION,
  contractVersion: 'flower.v1',
  healthOperation: 'health',
  capabilities: ['Catalog', 'GeoDelivery', 'TimeSlot', 'Order', 'Substitute', 'Cancel', 'Delivery', 'Refund', 'Statement', 'Webhook'],
  permissions: ['channel.flower.operate'],
  configSchema: 'provider.flower.v1',
  eventSubscriptions: ['ProviderWebhookReceived'],
  secretRefs: ['credential'],
  ...STANDARD_PROVIDER_POLICY,
  webhookContract: 'provider.flower.webhook.v1',
} as const satisfies UnsignedProviderManifest);

export function manifest(signature: string): ProviderManifest {
  if (!signature.trim()) throw new Error('FLOWER_MANIFEST_SIGNATURE_MISSING');
  return Object.freeze({ ...definition, signature });
}
