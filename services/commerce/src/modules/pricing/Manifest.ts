import { defineModuleManifest } from '../../composition/ModuleManifest';
import { CART_PRICING_PORT, CATALOG_PRICE_COMMAND_PORT, CATALOG_PRICING_PORT, CHECKOUT_PRICING_PORT, PRICING_READ_PORT, PROVIDER_PRICING_PORT, RUNTIME_PRICING_PORT } from './public';

export const Manifest = defineModuleManifest({
  id: 'pricing',
  services: ['database.pool', 'audit.sink'],
  ports: [CHECKOUT_PRICING_PORT, CART_PRICING_PORT, CATALOG_PRICING_PORT, CATALOG_PRICE_COMMAND_PORT, PRICING_READ_PORT],
  workloads: {
    jobs: { ports: [RUNTIME_PRICING_PORT] },
    provider: { dependencies: ['catalog', 'channel'], ports: [PROVIDER_PRICING_PORT] },
  },
});
