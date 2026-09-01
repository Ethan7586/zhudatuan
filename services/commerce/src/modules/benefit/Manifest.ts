import { defineModuleManifest } from '../../bootstrap/ModuleRegistry';
export const Manifest = defineModuleManifest('benefit', ['access', 'finance'], ['database.pool'], {
  jobs: { dependencies: ['finance', 'member'], bindings: ['finance'], services: ['database.pool'] },
});
