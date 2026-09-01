import type { ReadTransactionContext } from '../../../../foundation/persistence/TransactionContext';

import type { ProviderRepository } from '../port/ProviderRepository';
import type { IdentityProviderRegistryPort } from '../port/IdentityProviderRegistry';
import { ProviderPolicy } from '../../domain/policy/ProviderPolicy';
export class ProviderResolver {
  constructor(
    private readonly providers: ProviderRepository,
    private readonly registry: IdentityProviderRegistryPort,
    private readonly policy = new ProviderPolicy()
  ) {}
  async require(database: ReadTransactionContext, id: string) {
    const instance = await this.providers.require(database, id);
    this.policy.assertStartable(instance);
    return Object.freeze({ instance, strategy: this.registry.require(instance.type) });
  }
}
