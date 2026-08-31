import { defineModuleManifest } from '../../bootstrap/ModuleRegistry';
export const Manifest = defineModuleManifest(
  'identity',
  ['access', 'member', 'organization'],
  ['database.pool', 'audit.sink', 'identity.securitykeys', 'kms.client', 'identity.returntargets', 'risk.gate', 'secret.store', 'security.csrf', 'telemetry']
);
