import { TransportError } from '@shop/sdk';

export function approvedProviderRedirect(value: string): string {
  let destination: URL;
  try {
    destination = new URL(value);
  } catch (cause) {
    throw new TransportError('CONTRACT_INVALID', undefined, false, undefined, { cause });
  }
  if (destination.protocol !== 'https:' || destination.username || destination.password || destination.hash) throw new TransportError('CONTRACT_INVALID', undefined, false);
  return destination.toString();
}
