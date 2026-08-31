import { defineModuleManifest } from '../../bootstrap/ModuleRegistry';
export const Manifest = defineModuleManifest('organization', [], ['database.pool', 'audit.sink', 'secret.store', 'kms.client']);
