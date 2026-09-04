import { CAPABILITY_CODES_BY_OWNER } from '@shop/contract';
import { defineModuleManifest } from '../../bootstrap/ModuleManifest';
import { REPORTING_PORTS } from './public';

export const ReportingCapabilities = CAPABILITY_CODES_BY_OWNER.reporting;

export const Manifest = defineModuleManifest({
  id: 'reporting',
  dependencies: ['runtime'],
  services: ['database.pool', 'audit.sink', 'cache', 'object.store'],
  ports: REPORTING_PORTS,
  workloads: { jobs: { dependencies: ['runtime'], services: ['database.pool', 'cache'] } },
  capabilities: ReportingCapabilities,
});
