import { defineModuleManifest } from '@shop/kernel';

export const experienceManifest = defineModuleManifest({
  id: 'experience',
  version: '1.0.0',
  kind: 'business',
  provides: [],
  requires: ['catalog'],
  operations: [
    'experience.published.read',
    'experience.applications.create',
    'experience.applications.copy',
    'experience.applications.read',
    'experience.applications.update',
    'experience.versions.save',
    'experience.versions.validate',
    'experience.versions.publish',
    'experience.versions.restore',
  ],
  publishes: ['experience.published'],
  consumes: [],
  publicEntry: './index.ts',
  layers: ['public', 'domain', 'application', 'adapters', 'interface', 'tests'],
  entrypoints: {
    http: ['experienceOperations', 'experienceOperatorOperations'],
    jobs: ['experiencepublish'],
  },
});
