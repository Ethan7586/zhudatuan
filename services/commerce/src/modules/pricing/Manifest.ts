import { defineModuleManifest } from '../../bootstrap/ModuleRegistry';
export const Manifest = defineModuleManifest('pricing', [], ['database.pool', 'audit.sink']);
