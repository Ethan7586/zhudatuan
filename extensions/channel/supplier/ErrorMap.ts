import { mapProviderError, type ProviderError } from '@shop/providercore';

export function mapSupplierError(error: unknown): ProviderError {
  const mapped = mapProviderError(error);
  return Object.freeze({ ...mapped, code: 'SUPPLIER_' + mapped.code });
}
