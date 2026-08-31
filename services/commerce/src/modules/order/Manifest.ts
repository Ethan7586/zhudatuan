import { defineModuleManifest } from '../../bootstrap/ModuleRegistry';
export const Manifest = defineModuleManifest('order', ['organization', 'qualification'], ['database.pool', 'audit.sink', 'object.store']);
