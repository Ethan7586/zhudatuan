import { defineModuleManifest } from '../../bootstrap/ModuleRegistry';
export const Manifest = defineModuleManifest('channel', ['extension', 'organization', 'capability'], ['database.pool', 'audit.sink', 'kms.client', 'extension.loader', 'extension.manifestverifier']);
