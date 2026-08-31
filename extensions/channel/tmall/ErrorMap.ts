import { mapProviderError, type ProviderError } from '@shop/providercore';

export function mapTmallError(error: unknown): ProviderError {
  const mapped = mapProviderError(error);
  return Object.freeze({ ...mapped, code: 'TMALL_' + mapped.code });
}
