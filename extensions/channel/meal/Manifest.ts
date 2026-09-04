import { PROVIDER_API_VERSION, type ProviderManifest, type UnsignedProviderManifest } from '@shop/contract';
import { STANDARD_PROVIDER_POLICY } from '@shop/providercore';

export const definition = Object.freeze({
  id: 'meal',
  name: '在线点餐(肯德基、麦当劳、瑞幸、星巴克。 新增：库迪)',
  kind: 'channel',
  version: '1.0.0',
  apiVersion: PROVIDER_API_VERSION,
  contractVersion: 'meal.v1',
  dependencies: [],
  healthOperation: 'health',
  capabilities: ['Brand', 'Store', 'Menu', 'Option', 'Price', 'Inventory', 'Order', 'Pickup', 'Cancel', 'Refund', 'Statement', 'Verify', 'Webhook'],
  permissions: ['channel.meal.operate'],
  configSchema: 'provider.meal.v1',
  eventSubscriptions: ['ProviderWebhookReceived'],
  secretRefs: ['credential'],
  sandbox: { supported: true, mode: 'endpoint', endpointRef: 'provider.meal.sandboxurl' },
  ...STANDARD_PROVIDER_POLICY,
  webhookContract: 'provider.meal.webhook.v1',
} as const satisfies UnsignedProviderManifest);

export function manifest(signature: string): ProviderManifest {
  if (!signature.trim()) throw new Error('MEAL_MANIFEST_SIGNATURE_MISSING');
  return Object.freeze({ ...definition, signature });
}
