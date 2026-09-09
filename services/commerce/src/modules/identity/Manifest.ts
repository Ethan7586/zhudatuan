import { CAPABILITY_CODES_BY_OWNER } from '@shop/contract';
import { defineModuleManifest } from '../../composition/ModuleManifest';
import { IDENTITY_READ_PORT, MEMBER_IMPORT_IDENTITY_PORT, MEMBERSHIP_CONTEXT_PORT, NOTIFICATION_IDENTITY_PORT, PAYMENT_IDENTITY_PORT, RUNTIME_IDENTITY_PORT } from './public';

export const IdentityCapabilities = CAPABILITY_CODES_BY_OWNER.identity;

export const Manifest = defineModuleManifest({
  id: 'identity',
  dependencies: ['access', 'experience', 'member', 'organization'],
  services: ['database.pool', 'audit.sink', 'identity.challengecode', 'identity.securitykeys', 'kms.client', 'identity.returntargets', 'risk.gate', 'secret.store', 'security.csrf', 'telemetry'],
  ports: [NOTIFICATION_IDENTITY_PORT, MEMBERSHIP_CONTEXT_PORT, IDENTITY_READ_PORT, PAYMENT_IDENTITY_PORT],
  workloads: { jobs: { services: ['database.pool', 'identity.securitykeys', 'secret.store', 'telemetry'], ports: [NOTIFICATION_IDENTITY_PORT, MEMBER_IMPORT_IDENTITY_PORT, RUNTIME_IDENTITY_PORT] } },
  capabilities: IdentityCapabilities,
});
