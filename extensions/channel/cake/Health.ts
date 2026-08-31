import type { ProviderHealthProbe } from '@shop/providercore';

export function checkCakeHealth(client: ProviderHealthProbe): Promise<boolean> {
  return client.health();
}
