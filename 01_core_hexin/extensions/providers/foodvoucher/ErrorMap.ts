import { mapProviderError, type ProviderError } from '@shop/providercore';

export function mapFoodvoucherError(error: unknown): ProviderError {
  const mapped = mapProviderError(error);
  return Object.freeze({ ...mapped, code: 'FOODVOUCHER_' + mapped.code });
}
