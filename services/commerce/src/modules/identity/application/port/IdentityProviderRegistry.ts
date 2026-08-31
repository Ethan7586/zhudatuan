import type { IdentityProviderType } from '@shop/config/server';
import type { FederatedIdentityProvider } from './FederatedIdentityProvider';
export interface IdentityProviderRegistryPort {
  require(type: IdentityProviderType): FederatedIdentityProvider;
  types(): readonly IdentityProviderType[];
}
