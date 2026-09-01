import { defineModuleManifest } from '../../bootstrap/ModuleRegistry';

export const Manifest = defineModuleManifest('referral', ['member', 'catalog'], ['database.pool', 'security.keys'], {
  jobs: { dependencies: ['finance'], services: ['database.pool'] },
});
