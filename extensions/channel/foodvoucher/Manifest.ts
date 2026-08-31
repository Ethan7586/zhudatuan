import { PROVIDER_API_VERSION, type ProviderManifest, type UnsignedProviderManifest } from '@shop/contract';
import { STANDARD_PROVIDER_POLICY } from '@shop/providercore';

export const definition = Object.freeze({
  id: 'foodvoucher',
  kind: 'channel',
  version: '1.0.0',
  apiVersion: PROVIDER_API_VERSION,
  contractVersion: 'foodvoucher.v1',
  healthOperation: 'health',
  capabilities: ['Catalog', 'Issue', 'Bind', 'Verify', 'Void', 'Extend', 'Refund', 'Statement', 'Webhook'],
  permissions: ['channel.foodvoucher.operate'],
  configSchema: 'provider.foodvoucher.v1',
  eventSubscriptions: ['ProviderWebhookReceived'],
  secretRefs: ['credential'],
  ...STANDARD_PROVIDER_POLICY,
  webhookContract: 'provider.foodvoucher.webhook.v1',
} as const satisfies UnsignedProviderManifest);

export function manifest(signature: string): ProviderManifest {
  if (!signature.trim()) throw new Error('FOODVOUCHER_MANIFEST_SIGNATURE_MISSING');
  return Object.freeze({ ...definition, signature });
}
