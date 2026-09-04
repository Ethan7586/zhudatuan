import { defineModuleManifest } from '../../bootstrap/ModuleManifest';
import { OBSERVABILITY_CATALOG_PORT, OBSERVABILITY_LOG_PORT, OBSERVABILITY_METRIC_PORT, OBSERVABILITY_TRACE_PORT } from './public';

export const Manifest = defineModuleManifest({
  id: 'observability',
  services: ['observability.log', 'observability.metric', 'observability.trace', 'telemetry', 'telemetry.observations'],
  ports: [OBSERVABILITY_METRIC_PORT, OBSERVABILITY_TRACE_PORT, OBSERVABILITY_LOG_PORT, OBSERVABILITY_CATALOG_PORT],
  workloads: {
    jobs: { services: ['observability.log', 'observability.metric', 'observability.trace'], ports: [OBSERVABILITY_METRIC_PORT, OBSERVABILITY_TRACE_PORT, OBSERVABILITY_LOG_PORT, OBSERVABILITY_CATALOG_PORT] },
    provider: { services: ['observability.log', 'observability.metric', 'observability.trace'], ports: [OBSERVABILITY_METRIC_PORT, OBSERVABILITY_TRACE_PORT, OBSERVABILITY_LOG_PORT, OBSERVABILITY_CATALOG_PORT] },
  },
});
