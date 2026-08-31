import type { ProviderHealthProbe } from '@shop/providercore';

export function checkFlowerHealth(client: ProviderHealthProbe): Promise<boolean> {
  return client.health();
}
