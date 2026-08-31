import type { ProviderHealthProbe } from '@shop/providercore';

export function checkSupplierHealth(client: ProviderHealthProbe): Promise<boolean> {
  return client.health();
}
