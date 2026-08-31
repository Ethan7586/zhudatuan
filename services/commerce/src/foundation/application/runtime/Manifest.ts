import { defineModuleManifest } from '../../../bootstrap/ModuleRegistry';
export const Manifest = defineModuleManifest('runtime', [], ['database.pool', 'audit.sink', 'cache', 'database.querymetrics', 'extension.registry', 'identity.invitationkeyversions']);
