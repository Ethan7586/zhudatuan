import { PROVIDER_API_VERSION, type ProviderManifest, type UnsignedProviderManifest } from '@shop/contract';
import { STANDARD_PROVIDER_POLICY } from '@shop/providercore';

export const definition = Object.freeze({
  id: 'meal',
  kind: 'channel',
  version: '1.0.0',
  apiVersion: PROVIDER_API_VERSION,
  contractVersion: 'meal.v1',
  healthOperation: 'health',
  capabilities: ['Brand', 'Store', 'Menu', 'Option', 'Price', 'Inventory', 'Order', 'Pickup', 'Cancel', 'Refund', 'Statement', 'Verify', 'Webhook'],
  permissions: ['channel.meal.operate'],
  configSchema: 'provider.meal.v1',
  eventSubscriptions: ['ProviderWebhookReceived'],
  secretRefs: ['credential'],
  ...STANDARD_PROVIDER_POLICY,
  webhookContract: 'provider.meal.webhook.v1',
} as const satisfies UnsignedProviderManifest);

export function manifest(signature: string): ProviderManifest {
  if (!signature.trim()) throw new Error('MEAL_MANIFEST_SIGNATURE_MISSING');
  return Object.freeze({ ...definition, signature });
}
