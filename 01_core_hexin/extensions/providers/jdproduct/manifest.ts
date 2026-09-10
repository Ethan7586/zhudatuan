import { PROVIDER_API_VERSION,type ProviderManifest,type UnsignedProviderManifest } from '@shop/contract';
import { STANDARD_PROVIDER_LIMITS } from '@shop/providercore';

export const definition = Object.freeze({
  id: 'jdproduct',
  kind: 'channel',
  priority: 1,
  version: '1.0.0',
  apiVersion: PROVIDER_API_VERSION,
  contractVersion: 'jdproduct.v1',
  healthOperation: 'health',
  capabilities: ['Catalog', 'Price', 'Inventory', 'Order', 'Cancel', 'Return', 'Logistics', 'Refund', 'Statement', 'Webhook'],
  permissions: ['channel.jdproduct.operate'],
  configSchema: 'provider.jdproduct.v1',
  eventSubscriptions: ['ProviderWebhookReceived'],
  // Matches createJdClient authentication and createPorts webhook verification.
  secretRefs: ['keyId', 'privateKey', 'webhookSecret'],
  limits: STANDARD_PROVIDER_LIMITS,
} as const satisfies UnsignedProviderManifest);

export function manifest(signature: string): ProviderManifest {
  if (!signature.trim()) throw new Error('JDPRODUCT_MANIFEST_SIGNATURE_MISSING');
  return Object.freeze({ ...definition, signature });
}
