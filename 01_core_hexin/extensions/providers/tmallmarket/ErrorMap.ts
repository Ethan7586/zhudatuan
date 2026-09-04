import { mapProviderError, type ProviderError } from '@shop/providercore';

export function mapTmallmarketError(error: unknown): ProviderError {
  const mapped = mapProviderError(error);
  return Object.freeze({ ...mapped, code: 'TMALLMARKET_' + mapped.code });
}
