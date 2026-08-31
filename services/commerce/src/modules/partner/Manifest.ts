import { defineModuleManifest } from '../../bootstrap/ModuleRegistry';
export const Manifest = defineModuleManifest('partner', ['organization'], ['database.pool', 'audit.sink', 'kms.client']);
