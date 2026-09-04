import { CAPABILITY_CODES_BY_OWNER } from '@shop/contract';
import { defineModuleManifest } from '../../bootstrap/ModuleManifest';
import { AFTERSALE_POLICY_PORT, CATALOG_QUALIFICATION_PORT, CHECKOUT_QUALIFICATION_PORT } from './public';

export const QualificationCapabilities = CAPABILITY_CODES_BY_OWNER.qualification;
export const Manifest = defineModuleManifest({
  id: 'qualification',
  dependencies: ['runtime'],
  services: ['database.pool', 'audit.sink', 'object.store'],
  ports: [CHECKOUT_QUALIFICATION_PORT, AFTERSALE_POLICY_PORT, CATALOG_QUALIFICATION_PORT],
  workloads: { jobs: { services: ['database.pool'] } },
  capabilities: QualificationCapabilities,
});
