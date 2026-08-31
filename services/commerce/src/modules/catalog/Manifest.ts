import { defineModuleManifest } from '../../bootstrap/ModuleRegistry';
export const Manifest = defineModuleManifest('catalog', ['inventory', 'organization', 'partner', 'pricing'], ['database.pool', 'audit.sink', 'object.store']);
