import { defineModuleManifest } from '../../bootstrap/ModuleRegistry';
export const Manifest = defineModuleManifest('marketing', [], ['database.pool', 'audit.sink']);
