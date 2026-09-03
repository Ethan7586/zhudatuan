import type { OperationOutputFor } from '@shop/contract';
import { TransportError } from '@shop/sdk';
import type { Provider } from '../model/Provider';

export function mapProviders(value: OperationOutputFor<'identity.providers.read'>): readonly Provider[] {
  return Object.freeze(value.items.map(({ id, type }) => Object.freeze({ id, type })));
}

export function mapFederationRedirect(value: OperationOutputFor<'identity.federations.start'>) {
  let destination: URL;
  try {
    destination = new URL(value.location);
  } catch (cause) {
    throw new TransportError('CONTRACT_INVALID', undefined, false, undefined, { cause });
  }
  if (destination.protocol !== 'https:' || destination.username || destination.password || destination.hash) throw new TransportError('CONTRACT_INVALID', undefined, false);
  return Object.freeze({ redirectUrl: destination.toString() });
}
