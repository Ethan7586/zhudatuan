import { defineModuleManifest } from '../../bootstrap/ModuleRegistry';
export const Manifest = defineModuleManifest('access', ['organization', 'partner'], ['database.pool', 'audit.sink']);
