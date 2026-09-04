import { PROVIDER_API_VERSION, type ProviderManifest, type UnsignedProviderManifest } from '@shop/contract';
import { STANDARD_PROVIDER_POLICY } from '@shop/providercore';

export const definition = Object.freeze({
  id: 'supplier',
  name: '自有供应商',
  kind: 'channel',
  version: '1.0.0',
  apiVersion: PROVIDER_API_VERSION,
  contractVersion: 'supplier.v1',
  dependencies: [],
  healthOperation: 'local',
  capabilities: ['Catalog', 'Price', 'Inventory', 'Order', 'Shipment', 'Return', 'Refund', 'Statement'],
  permissions: ['channel.supplier.operate'],
  configSchema: 'provider.supplier.v1',
  eventSubscriptions: [],
  secretRefs: [],
  sandbox: { supported: true, mode: 'local', endpointRef: null },
  ...STANDARD_PROVIDER_POLICY,
  webhookContract: null,
} as const satisfies UnsignedProviderManifest);

export function manifest(signature: string): ProviderManifest {
  if (!signature.trim()) throw new Error('SUPPLIER_MANIFEST_SIGNATURE_MISSING');
  return Object.freeze({ ...definition, signature });
}
