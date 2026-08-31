import { defineModuleManifest } from '../../bootstrap/ModuleRegistry';
export const Manifest = defineModuleManifest('audit', [], ['database.pool', 'audit.sink', 'audit.port']);
