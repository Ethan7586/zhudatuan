import { defineModuleManifest } from '../../bootstrap/ModuleRegistry';
export const Manifest = defineModuleManifest('voucher', ['access', 'finance', 'organization'], ['database.pool', 'audit.sink', 'object.store']);
