import { defineModuleManifest } from '@shop/kernel';

export const provisioningManifest = defineModuleManifest({
  id: 'provisioning',
  version: '1.0.0',
  kind: 'business',
  provides: [],
  requires: ['organization', 'catalog', 'experience'],
  operations: [
    'provisioning.malls.create',
    'provisioning.malls.read',
  ],
  publishes: [],
  consumes: [],
  publicEntry: './index.ts',
  layers: ['public', 'domain', 'application', 'interface', 'tests'],
  entrypoints: {
    http: ['provisioningOperations'],
    jobs: [],
  },
});
