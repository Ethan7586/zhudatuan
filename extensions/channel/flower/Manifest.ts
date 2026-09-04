import { PROVIDER_API_VERSION, type ProviderManifest, type UnsignedProviderManifest } from '@shop/contract';
import { STANDARD_PROVIDER_POLICY } from '@shop/providercore';

export const definition = Object.freeze({
  id: 'flower',
  name: '鲜花（花千束、花映里、花礼甄选、爱在此刻鲜花）',
  kind: 'channel',
  version: '1.0.0',
  apiVersion: PROVIDER_API_VERSION,
  contractVersion: 'flower.v1',
  dependencies: [],
  healthOperation: 'health',
  capabilities: ['Catalog', 'GeoDelivery', 'TimeSlot', 'Order', 'Substitute', 'Cancel', 'Delivery', 'Refund', 'Statement', 'Webhook'],
  permissions: ['channel.flower.operate'],
  configSchema: 'provider.flower.v1',
  eventSubscriptions: ['ProviderWebhookReceived'],
  secretRefs: ['credential'],
  sandbox: { supported: true, mode: 'endpoint', endpointRef: 'provider.flower.sandboxurl' },
  ...STANDARD_PROVIDER_POLICY,
  webhookContract: 'provider.flower.webhook.v1',
} as const satisfies UnsignedProviderManifest);

export function manifest(signature: string): ProviderManifest {
  if (!signature.trim()) throw new Error('FLOWER_MANIFEST_SIGNATURE_MISSING');
  return Object.freeze({ ...definition, signature });
}
