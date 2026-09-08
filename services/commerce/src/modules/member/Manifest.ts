import { defineModuleManifest } from '../../composition/ModuleManifest';
import { BENEFIT_MEMBER_PORT, IDENTITY_MEMBER_PORT, IDENTITY_REGISTRATION_PORT, MEMBER_ADDRESS_PORT, MEMBER_READ_PORT, REFERRAL_MEMBER_PORT } from './public';

export const Manifest = defineModuleManifest({
  id: 'member',
  dependencies: ['access', 'catalog', 'runtime'],
  services: ['database.pool', 'audit.sink', 'kms.client', 'object.store'],
  ports: [IDENTITY_MEMBER_PORT, IDENTITY_REGISTRATION_PORT, REFERRAL_MEMBER_PORT, BENEFIT_MEMBER_PORT, MEMBER_READ_PORT, MEMBER_ADDRESS_PORT],
  workloads: { jobs: { dependencies: ['access', 'identity', 'runtime'], services: ['database.pool', 'object.store'], ports: [BENEFIT_MEMBER_PORT] } },
});
