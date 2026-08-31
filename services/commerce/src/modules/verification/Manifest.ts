import { defineModuleManifest } from '../../bootstrap/ModuleRegistry';
export const Manifest = defineModuleManifest('verification', ['access', 'organization', 'voucher'], ['database.pool', 'audit.sink']);
