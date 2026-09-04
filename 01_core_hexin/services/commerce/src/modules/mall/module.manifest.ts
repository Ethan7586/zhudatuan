import { defineModuleManifest } from '@shop/kernel';

export const mallManifest = defineModuleManifest({
  id: 'mall',
  version: '1.0.0',
  kind: 'business',
  provides: [],
  requires: [],
  operations: [],
  publishes: [],
  consumes: [],
  publicEntry: './index.ts',
  layers: ['domain', 'tests'],
  entrypoints: {
    http: [],
    jobs: [],
  },
});
