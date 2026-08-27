import { mapProviderError, type ProviderError } from '@shop/providercore';

export function mapFlowerError(error: unknown): ProviderError {
  const mapped = mapProviderError(error);
  return Object.freeze({ ...mapped, code: 'FLOWER_' + mapped.code });
}
