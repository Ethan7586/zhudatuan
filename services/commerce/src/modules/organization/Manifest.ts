import { CAPABILITY_CODES_BY_OWNER } from '@shop/contract';
import { defineModuleManifest } from '../../composition/ModuleManifest';
import { ACCESS_ORGANIZATION_PORT, CHANNEL_ORGANIZATION_PORT, IDENTITY_ORGANIZATION_PORT, MALL_PROVISION_PORT, NAVIGATION_ORGANIZATION_PORT, ORGANIZATION_HIERARCHY_PORT, ORGANIZATION_READ_PORT } from './public';

export const OrganizationCapabilities = CAPABILITY_CODES_BY_OWNER.organization;

export const Manifest = defineModuleManifest({
  id: 'organization',
  services: ['database.pool', 'audit.sink', 'secret.store', 'kms.client'],
  ports: [IDENTITY_ORGANIZATION_PORT, ACCESS_ORGANIZATION_PORT, CHANNEL_ORGANIZATION_PORT, NAVIGATION_ORGANIZATION_PORT, ORGANIZATION_READ_PORT, ORGANIZATION_HIERARCHY_PORT, MALL_PROVISION_PORT],
  workloads: {
    jobs: { dependencies: ['access', 'runtime'], services: ['database.pool', 'secret.store', 'kms.client', 'identity.securitykeys'], ports: [ORGANIZATION_READ_PORT, MALL_PROVISION_PORT] },
    provider: { ports: [ORGANIZATION_READ_PORT] },
  },
  capabilities: OrganizationCapabilities,
});
