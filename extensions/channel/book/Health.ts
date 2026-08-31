import type { ProviderHealthProbe } from '@shop/providercore';

export function checkBookHealth(client: ProviderHealthProbe): Promise<boolean> {
  return client.health();
}
