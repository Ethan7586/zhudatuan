import { mapProviderError, type ProviderError } from '@shop/providercore';

export function mapBookError(error: unknown): ProviderError {
  const mapped = mapProviderError(error);
  return Object.freeze({ ...mapped, code: 'BOOK_' + mapped.code });
}
