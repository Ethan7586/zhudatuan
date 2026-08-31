import { PROVIDER_API_VERSION, type ProviderManifest, type UnsignedProviderManifest } from '@shop/contract';
import { STANDARD_PROVIDER_POLICY } from '@shop/providercore';

export const definition = Object.freeze({
  id: 'supplier',
  kind: 'channel',
  version: '1.0.0',
  apiVersion: PROVIDER_API_VERSION,
  contractVersion: 'supplier.v1',
  healthOperation: 'local',
  capabilities: ['Catalog', 'Inventory', 'Order', 'Shipment', 'Return', 'Refund', 'Statement'],
  permissions: ['channel.supplier.operate'],
  configSchema: 'provider.supplier.v1',
  eventSubscriptions: [],
  secretRefs: [],
  ...STANDARD_PROVIDER_POLICY,
  webhookContract: 'provider.supplier.webhook.v1',
} as const satisfies UnsignedProviderManifest);

export function manifest(signature: string): ProviderManifest {
  if (!signature.trim()) throw new Error('SUPPLIER_MANIFEST_SIGNATURE_MISSING');
  return Object.freeze({ ...definition, signature });
}
