import { defineModuleManifest } from '@shop/kernel';
import { ORGANIZATION_CAPABILITIES } from './01_public_gongkai/OrganizationCapabilities';

export const organizationManifest = defineModuleManifest({
  id: 'organization',
  version: '1.0.0',
  kind: 'business',
  provides: Object.values(ORGANIZATION_CAPABILITIES),
  requires: [],
  operations: ['organization.layers.read'],
  publishes: [],
  consumes: [],
  publicEntry: './index.ts',
  layers: ['public', 'application', 'interface', 'tests'],
  entrypoints: {
    http: ['organizationOperations'],
    jobs: [],
  },
});
