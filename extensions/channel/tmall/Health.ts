import type { ProviderHealthProbe } from '@shop/providercore';

export function checkTmallHealth(client: ProviderHealthProbe): Promise<boolean> {
  return client.health();
}
