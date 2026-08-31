import { defineModuleManifest } from '../../bootstrap/ModuleRegistry';
export const Manifest = defineModuleManifest('risk', [], ['database.pool', 'audit.sink']);
