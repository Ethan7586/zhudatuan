import { mapProviderError, type ProviderError } from '@shop/providercore';

export function mapJdfreshError(error: unknown): ProviderError {
  const mapped = mapProviderError(error);
  return Object.freeze({ ...mapped, code: 'JDFRESH_' + mapped.code });
}
