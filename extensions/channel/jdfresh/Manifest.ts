import { PROVIDER_API_VERSION, type ProviderManifest, type UnsignedProviderManifest } from '@shop/contract';
import { STANDARD_PROVIDER_POLICY } from '@shop/providercore';

export const definition = Object.freeze({
  id: 'jdfresh',
  name: '京东生鲜',
  kind: 'channel',
  version: '1.0.0',
  apiVersion: PROVIDER_API_VERSION,
  contractVersion: 'jdfresh.v1',
  dependencies: [],
  healthOperation: 'health',
  capabilities: ['Catalog', 'GeoStock', 'TimeSlot', 'Order', 'Cancel', 'Refund', 'Delivery', 'Statement', 'Webhook'],
  permissions: ['channel.jdfresh.operate'],
  configSchema: 'provider.jdfresh.v1',
  eventSubscriptions: ['ProviderWebhookReceived'],
  secretRefs: ['credential'],
  sandbox: { supported: true, mode: 'endpoint', endpointRef: 'provider.jdfresh.sandboxurl' },
  ...STANDARD_PROVIDER_POLICY,
  webhookContract: 'provider.jdfresh.webhook.v1',
} as const satisfies UnsignedProviderManifest);

export function manifest(signature: string): ProviderManifest {
  if (!signature.trim()) throw new Error('JDFRESH_MANIFEST_SIGNATURE_MISSING');
  return Object.freeze({ ...definition, signature });
}
