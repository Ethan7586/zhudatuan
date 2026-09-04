import { PROVIDER_API_VERSION, type ProviderManifest, type UnsignedProviderManifest } from '@shop/contract';
import { STANDARD_PROVIDER_POLICY } from '@shop/providercore';

export const definition = Object.freeze({
  id: 'tmall',
  name: '天猫超市',
  kind: 'channel',
  version: '1.0.0',
  apiVersion: PROVIDER_API_VERSION,
  contractVersion: 'tmall.v1',
  dependencies: [],
  healthOperation: 'health',
  capabilities: ['Catalog', 'Price', 'Inventory', 'Order', 'Cancel', 'Return', 'Logistics', 'Refund', 'Statement', 'Webhook'],
  permissions: ['channel.tmall.operate'],
  configSchema: 'provider.tmall.v1',
  eventSubscriptions: ['ProviderWebhookReceived'],
  secretRefs: ['credential'],
  sandbox: { supported: true, mode: 'endpoint', endpointRef: 'provider.tmall.sandboxurl' },
  ...STANDARD_PROVIDER_POLICY,
  webhookContract: 'provider.tmall.webhook.v1',
} as const satisfies UnsignedProviderManifest);

export function manifest(signature: string): ProviderManifest {
  if (!signature.trim()) throw new Error('TMALL_MANIFEST_SIGNATURE_MISSING');
  return Object.freeze({ ...definition, signature });
}
