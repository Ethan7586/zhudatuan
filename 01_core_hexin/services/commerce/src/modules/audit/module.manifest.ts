import { defineModuleManifest } from '@shop/kernel';

export const auditManifest = defineModuleManifest({
  id: 'audit',
  version: '1.0.0',
  kind: 'business',
  provides: [],
  requires: [],
  operations: ['audit.records.read'],
  publishes: [],
  consumes: [],
  publicEntry: './index.ts',
  layers: ['public', 'domain', 'application', 'adapters', 'interface', 'tests'],
  entrypoints: {
    http: ['auditRoutes'],
    jobs: ['auditarchive'],
  },
});
