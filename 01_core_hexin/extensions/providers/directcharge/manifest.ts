import { PROVIDER_API_VERSION,type ProviderManifest,type UnsignedProviderManifest } from '@shop/contract';
import { STANDARD_PROVIDER_LIMITS } from '@shop/providercore';

export const definition = Object.freeze({
  id: 'directcharge',
  kind: 'channel',
  priority: 1,
  version: '1.0.0',
  apiVersion: PROVIDER_API_VERSION,
  contractVersion: 'directcharge.v1',
  healthOperation: 'health',
  capabilities: ['Catalog', 'Issue', 'DirectCharge', 'Query', 'Refund', 'Statement', 'Verify', 'Webhook'],
  permissions: ['channel.directcharge.operate'],
  configSchema: 'provider.directcharge.v1',
  eventSubscriptions: ['ProviderWebhookReceived'],
  // Matches createWanlianClient authentication and createPorts webhook verification.
  secretRefs: ['keyId', 'privateKey', 'webhookSecret'],
  limits: STANDARD_PROVIDER_LIMITS,
} as const satisfies UnsignedProviderManifest);

export function manifest(signature: string): ProviderManifest {
  if (!signature.trim()) throw new Error('DIRECTCHARGE_MANIFEST_SIGNATURE_MISSING');
  return Object.freeze({ ...definition, signature });
}
