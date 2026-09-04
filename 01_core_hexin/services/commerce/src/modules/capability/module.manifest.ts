import { defineModuleManifest } from '@shop/kernel';
import { CAPABILITY_CAPABILITIES } from './01_public_gongkai/CapabilityCapabilities';

export const capabilityManifest = defineModuleManifest({
  id: 'capability',
  version: '1.0.0',
  kind: 'business',
  provides: [CAPABILITY_CAPABILITIES.read, CAPABILITY_CAPABILITIES.manage],
  requires: ['organization'],
  operations: ['capability.assignments.read', 'capability.assignments.manage'],
  publishes: [],
  consumes: [],
  publicEntry: './index.ts',
  layers: ['public', 'application', 'interface', 'tests'],
  entrypoints: {
    http: ['capabilityOperations'],
    jobs: [],
  },
});
