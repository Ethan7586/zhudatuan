import { PROVIDER_API_VERSION, type ProviderManifest, type UnsignedProviderManifest } from '@shop/contract';
import { STANDARD_PROVIDER_POLICY } from '@shop/providercore';

export const definition = Object.freeze({
  id: 'charge',
  kind: 'channel',
  version: '1.0.0',
  apiVersion: PROVIDER_API_VERSION,
  contractVersion: 'charge.v1',
  healthOperation: 'health',
  capabilities: ['Catalog', 'Issue', 'DirectCharge', 'Query', 'Refund', 'Statement', 'Verify', 'Webhook'],
  permissions: ['channel.charge.operate'],
  configSchema: 'provider.charge.v1',
  eventSubscriptions: ['ProviderWebhookReceived'],
  secretRefs: ['credential'],
  ...STANDARD_PROVIDER_POLICY,
  webhookContract: 'provider.charge.webhook.v1',
} as const satisfies UnsignedProviderManifest);

export function manifest(signature: string): ProviderManifest {
  if (!signature.trim()) throw new Error('CHARGE_MANIFEST_SIGNATURE_MISSING');
  return Object.freeze({ ...definition, signature });
}
