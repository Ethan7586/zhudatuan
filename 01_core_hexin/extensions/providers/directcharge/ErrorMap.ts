import { mapProviderError, type ProviderError } from '@shop/providercore';

export function mapDirectchargeError(error: unknown): ProviderError {
  const mapped = mapProviderError(error);
  return Object.freeze({ ...mapped, code: 'DIRECTCHARGE_' + mapped.code });
}
