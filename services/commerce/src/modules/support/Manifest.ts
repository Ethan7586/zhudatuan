import { defineModuleManifest } from '../../bootstrap/ModuleRegistry';
export const Manifest = defineModuleManifest('support', ['access', 'order', 'benefit', 'organization'], ['database.pool', 'audit.sink', 'kms.client', 'object.store']);
