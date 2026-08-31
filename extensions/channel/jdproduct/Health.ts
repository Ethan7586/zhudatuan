import type { ProviderHealthProbe } from '@shop/providercore';

export function checkJdproductHealth(client: ProviderHealthProbe): Promise<boolean> {
  return client.health();
}
