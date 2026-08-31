import { mapProviderError, type ProviderError } from '@shop/providercore';

export function mapMovieError(error: unknown): ProviderError {
  const mapped = mapProviderError(error);
  return Object.freeze({ ...mapped, code: 'MOVIE_' + mapped.code });
}
