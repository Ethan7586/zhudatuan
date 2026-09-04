import { mapProviderError, type ProviderError } from '@shop/providercore';

export function mapMealError(error: unknown): ProviderError {
  const mapped = mapProviderError(error);
  return Object.freeze({ ...mapped, code: 'MEAL_' + mapped.code });
}
