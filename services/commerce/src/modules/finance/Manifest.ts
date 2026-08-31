import { defineModuleManifest } from '../../bootstrap/ModuleRegistry';
export const Manifest = defineModuleManifest('finance', ['access', 'organization'], ['database.pool', 'audit.sink', 'kms.client', 'object.store', 'security.keys']);
