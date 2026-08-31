import type { ProviderHealthProbe } from '@shop/providercore';

export function checkFoodvoucherHealth(client: ProviderHealthProbe): Promise<boolean> {
  return client.health();
}
