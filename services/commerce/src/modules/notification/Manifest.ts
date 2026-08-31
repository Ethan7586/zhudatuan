import { defineModuleManifest } from '../../bootstrap/ModuleRegistry';
export const Manifest = defineModuleManifest('notification', ['access', 'identity', 'organization'], ['database.pool', 'audit.sink', 'kms.client']);
