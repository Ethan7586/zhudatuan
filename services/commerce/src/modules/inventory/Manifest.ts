import { defineModuleManifest } from '../../bootstrap/ModuleRegistry';
export const Manifest = defineModuleManifest('inventory', [], ['database.pool', 'audit.sink', 'object.store']);
