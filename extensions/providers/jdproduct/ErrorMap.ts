import { mapProviderError, type ProviderError } from '@shop/providercore';

export function mapJdproductError(error: unknown): ProviderError {
  const mapped = mapProviderError(error);
  return Object.freeze({ ...mapped, code: 'JDPRODUCT_' + mapped.code });
}
