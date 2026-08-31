import { defineModuleManifest } from '../../bootstrap/ModuleRegistry';
export const Manifest = defineModuleManifest('fulfillment', ['order', 'organization'], ['database.pool', 'audit.sink']);
