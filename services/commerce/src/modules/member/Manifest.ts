import { defineModuleManifest } from '../../bootstrap/ModuleRegistry';
export const Manifest = defineModuleManifest('member', ['access', 'catalog', 'checkout'], ['database.pool', 'audit.sink', 'kms.client', 'object.store']);
