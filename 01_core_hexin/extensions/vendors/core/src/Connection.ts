import type { ProviderLimit } from '@shop/contract';

export interface VendorConnection {
  readonly id: string;
  readonly baseUrl: string;
  readonly secret: Readonly<Record<string, string>>;
  readonly endpoints: Readonly<Record<string, string>>;
  readonly limits: ProviderLimit;
  readonly healthOperation: string;
}

export function validateConnection(connection: VendorConnection): VendorConnection {
  if (!connection.id.trim()) throw new Error('VENDOR_CONNECTION_ID_MISSING');
  const url = new URL(connection.baseUrl);
  if (url.protocol !== 'https:') throw new Error('VENDOR_BASE_URL_HTTPS_REQUIRED');
  if (!Object.keys(connection.secret).length) throw new Error('VENDOR_SECRET_MISSING');
  if (!connection.endpoints[connection.healthOperation]) throw new Error('VENDOR_HEALTH_OPERATION_MISSING');
  for (const [operation, endpoint] of Object.entries(connection.endpoints)) {
    if (!operation.trim() || !endpoint.startsWith('/') || endpoint.startsWith('//')) throw new Error('VENDOR_ENDPOINT_INVALID');
  }
  return Object.freeze(connection);
}
