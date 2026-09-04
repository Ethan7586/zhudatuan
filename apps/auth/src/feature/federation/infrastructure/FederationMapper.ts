import type { OperationOutputFor } from '@shop/contract';
import type { Provider } from '../model/Provider';
import { approvedProviderRedirect } from '../../../shared/security/ProviderRedirect';

export function mapProviders(value: OperationOutputFor<'identity.providers.read'>): readonly Provider[] {
  return Object.freeze(value.items.map(({ id, type }) => Object.freeze({ id, type })));
}

export function mapFederationRedirect(value: OperationOutputFor<'identity.federations.start'>) {
  return Object.freeze({ redirectUrl: approvedProviderRedirect(value.location) });
}
