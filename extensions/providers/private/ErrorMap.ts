import { mapProviderError, type ProviderError } from '@shop/providercore';

export function mapPrivateError(error: unknown): ProviderError {
  const mapped = mapProviderError(error);
  return Object.freeze({ ...mapped, code: 'PRIVATE_' + mapped.code });
}
