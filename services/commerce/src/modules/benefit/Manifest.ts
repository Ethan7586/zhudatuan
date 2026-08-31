import { defineModuleManifest } from '../../bootstrap/ModuleRegistry';
export const Manifest = defineModuleManifest('benefit', ['access', 'finance'], ['database.pool', 'audit.sink']);
