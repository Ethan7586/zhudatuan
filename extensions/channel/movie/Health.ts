import type { ProviderHealthProbe } from '@shop/providercore';

export function checkMovieHealth(client: ProviderHealthProbe): Promise<boolean> {
  return client.health();
}
