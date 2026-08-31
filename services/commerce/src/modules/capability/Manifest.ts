import { defineModuleManifest } from '../../bootstrap/ModuleRegistry';
export const Manifest = defineModuleManifest('capability', ['organization'], ['database.pool', 'audit.sink']);
