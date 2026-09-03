import { defineModuleManifest } from '../../bootstrap/ModuleRegistry';
export const Manifest = defineModuleManifest('order', ['organization', 'qualification', 'audit'], ['database.pool', 'audit.sink', 'object.store']);
