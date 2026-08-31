import { defineModuleManifest } from '../../bootstrap/ModuleRegistry';
export const Manifest = defineModuleManifest('experience', ['catalog', 'marketing', 'organization'], ['database.pool', 'audit.sink', 'cache']);
