import type { ProviderHealthProbe } from '@shop/providercore';

export function checkJdfreshHealth(client: ProviderHealthProbe): Promise<boolean> {
  return client.health();
}
