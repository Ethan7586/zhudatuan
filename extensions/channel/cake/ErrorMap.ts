import { mapProviderError, type ProviderError } from '@shop/providercore';

export function mapCakeError(error: unknown): ProviderError {
  const mapped = mapProviderError(error);
  return Object.freeze({ ...mapped, code: 'CAKE_' + mapped.code });
}
