import { defineModuleManifest } from '../../bootstrap/ModuleRegistry';

export const Manifest = defineModuleManifest('referral', ['member', 'catalog'], ['database.pool', 'audit.sink', 'security.keys']);
