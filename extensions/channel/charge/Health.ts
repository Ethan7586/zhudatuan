import type { ProviderHealthProbe } from '@shop/providercore';

export function checkChargeHealth(client: ProviderHealthProbe): Promise<boolean> {
  return client.health();
}
