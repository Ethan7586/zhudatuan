import { defineModuleManifest } from '@shop/kernel';

export const extensionManifest = defineModuleManifest({
  id: 'extension',
  version: '1.0.0',
  kind: 'business',
  provides: [],
  requires: ['capability'],
  operations: ['extension.installations.read'],
  publishes: [
    'extension.enabled',
    'extension.disabled',
    'extension.degraded',
  ],
  consumes: [],
  publicEntry: './index.ts',
  layers: ['public', 'domain', 'application', 'adapters', 'interface', 'tests'],
  entrypoints: {
    http: ['extensionRoutes'],
    jobs: ['extensionhealth'],
  },
});
