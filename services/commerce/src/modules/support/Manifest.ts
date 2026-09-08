import { CAPABILITY_CODES_BY_OWNER } from '@shop/contract';
import { defineModuleManifest } from '../../composition/ModuleManifest';
import { SUPPORT_PORTS } from './public';

export const SupportCapabilities = CAPABILITY_CODES_BY_OWNER.support;

export const Manifest = defineModuleManifest({
  id: 'support',
  dependencies: ['access', 'order', 'benefit', 'organization', 'member', 'runtime'],
  services: ['event.stream', 'kms.client', 'object.store', 'secret.store'],
  ports: SUPPORT_PORTS,
  workloads: { jobs: { dependencies: ['runtime'], bindings: ['runtime'], services: ['database.pool', 'object.store', 'event.stream'] } },
  capabilities: SupportCapabilities,
});
