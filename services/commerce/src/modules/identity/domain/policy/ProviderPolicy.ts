import { DomainError } from '../../../../platform/error/DomainError';
import { IDENTITY_PROVIDER_CONFIGURATION } from '@shop/config/server';
import type { ProviderInstance } from '../model/ProviderInstance';
export class ProviderPolicy {
  assertStartable(provider: ProviderInstance): void {
    if (!provider.enabled()) throw new DomainError('IDENTITY_PROVIDER_DISABLED');
  }
  assertSecretRef(value: string): void {
    if (!IDENTITY_PROVIDER_CONFIGURATION.secretReference.test(value)) throw new DomainError('IDENTITY_PROVIDER_CONFIGURATION_INVALID');
  }
}
