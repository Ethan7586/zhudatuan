import { defineModuleManifest } from '../../bootstrap/ModuleRegistry';

export const Manifest = defineModuleManifest('runtime', ['capability', 'identity'], ['cache', 'database.querymetrics', 'extension.registry', 'identity.invitationkeyversions'], {
  jobs: { dependencies: ['identity', 'checkout', 'pricing'], services: ['database.pool'] },
});
