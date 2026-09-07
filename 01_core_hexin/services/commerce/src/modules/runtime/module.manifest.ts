import { defineModuleManifest } from '@shop/kernel';

/** Runtime-owned, process-lived platform host. Its profile probes are replaceable; domain state ownership is forbidden. */
export const runtimeManifest = defineModuleManifest({
  id: 'runtime',
  version: '1.0.0',
  kind: 'platform',
  provides: [],
  requires: [
    'checkout.manage',
    'identity.manage',
    'pricing.manage',
  ],
  operations: [
    'runtime.health.live',
    'runtime.health.ready',
    'runtime.health.startup',
    'runtime.health.dependency',
  ],
  publishes: [],
  consumes: [],
  publicEntry: './index.ts',
  layers: ['public', 'application', 'interface', 'tests'],
  entrypoints: {
    http: [
      'RuntimeModule',
      'CatalogOperatorRuntimeModule',
      'IdentityRegistrationRuntimeModule',
      'MallProvisioningRuntimeModule',
      'PurchaseRuntimeModule',
      'WebBusinessRuntimeModule',
    ],
    jobs: ['cleanup'],
  },
});
