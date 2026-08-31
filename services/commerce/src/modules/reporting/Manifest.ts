import { defineModuleManifest } from '../../bootstrap/ModuleRegistry';
export const Manifest = defineModuleManifest('reporting', [], ['database.pool', 'audit.sink', 'cache', 'object.store']);
