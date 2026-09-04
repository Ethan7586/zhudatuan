import { PROVIDER_API_VERSION, type ProviderManifest, type UnsignedProviderManifest } from '@shop/contract';
import { STANDARD_PROVIDER_POLICY } from '@shop/providercore';

export const definition = Object.freeze({
  id: 'foodvoucher',
  name: '虚拟食品提货券(元祖、仟吉、BONCAKE、蛋糕王国、囍甜、一鸣真鲜奶……）',
  kind: 'channel',
  version: '1.0.0',
  apiVersion: PROVIDER_API_VERSION,
  contractVersion: 'foodvoucher.v1',
  dependencies: [],
  healthOperation: 'health',
  capabilities: ['Catalog', 'GeoStore', 'Issue', 'Bind', 'Verify', 'Void', 'Extend', 'Refund', 'Statement', 'Webhook'],
  permissions: ['channel.foodvoucher.operate'],
  configSchema: 'provider.foodvoucher.v1',
  eventSubscriptions: ['ProviderWebhookReceived'],
  secretRefs: ['credential'],
  sandbox: { supported: true, mode: 'endpoint', endpointRef: 'provider.foodvoucher.sandboxurl' },
  ...STANDARD_PROVIDER_POLICY,
  webhookContract: 'provider.foodvoucher.webhook.v1',
} as const satisfies UnsignedProviderManifest);

export function manifest(signature: string): ProviderManifest {
  if (!signature.trim()) throw new Error('FOODVOUCHER_MANIFEST_SIGNATURE_MISSING');
  return Object.freeze({ ...definition, signature });
}
