import { mapProviderError, type ProviderError } from '@shop/providercore';

export function mapChargeError(error: unknown): ProviderError {
  const mapped = mapProviderError(error);
  return Object.freeze({ ...mapped, code: 'CHARGE_' + mapped.code });
}
