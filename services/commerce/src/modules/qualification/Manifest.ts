import { defineModuleManifest } from '../../bootstrap/ModuleRegistry';
export const Manifest = defineModuleManifest('qualification', [], ['database.pool', 'audit.sink']);
