import type { ProviderHealthProbe } from '@shop/providercore';

export function checkMealHealth(client: ProviderHealthProbe): Promise<boolean> {
  return client.health();
}
