import { PROVIDER_API_VERSION, type ProviderManifest, type UnsignedProviderManifest } from '@shop/contract';
import { STANDARD_PROVIDER_POLICY } from '@shop/providercore';

export const definition = Object.freeze({
  id: 'book',
  name: '图书',
  kind: 'channel',
  version: '1.0.0',
  apiVersion: PROVIDER_API_VERSION,
  contractVersion: 'book.v1',
  dependencies: [],
  healthOperation: 'health',
  capabilities: ['Catalog', 'Price', 'Inventory', 'Order', 'Cancel', 'Return', 'Shipment', 'Refund', 'Statement', 'Webhook'],
  permissions: ['channel.book.operate'],
  configSchema: 'provider.book.v1',
  eventSubscriptions: ['ProviderWebhookReceived'],
  secretRefs: ['credential'],
  sandbox: { supported: true, mode: 'endpoint', endpointRef: 'provider.book.sandboxurl' },
  ...STANDARD_PROVIDER_POLICY,
  webhookContract: 'provider.book.webhook.v1',
} as const satisfies UnsignedProviderManifest);

export function manifest(signature: string): ProviderManifest {
  if (!signature.trim()) throw new Error('BOOK_MANIFEST_SIGNATURE_MISSING');
  return Object.freeze({ ...definition, signature });
}
