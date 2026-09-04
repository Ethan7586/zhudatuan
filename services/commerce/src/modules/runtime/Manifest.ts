import { defineModuleManifest } from '../../bootstrap/ModuleManifest';
import { EVENT_EVIDENCE_READ_PORT, EVENT_REPLAY_PORT, EXPORT_PORT, EXPORT_RUNNER_PORT, IMPORT_BATCH_FACTORY_PORT, IMPORT_OBJECT_PORT, IMPORT_RUNNER_PORT, JOB_PORT, LEASE_PORT, OUTBOX_RELAY_PORT, RUNTIME_IMPORT_PORT, TABULAR_FILE_PORT } from './public';

export const Manifest = defineModuleManifest({
  id: 'runtime',
  dependencies: ['capability', 'identity', 'observability'],
  services: ['cache', 'database.querymetrics', 'extension.registry', 'identity.invitationkeyversions', 'object.store'],
  ports: [RUNTIME_IMPORT_PORT, JOB_PORT, EXPORT_PORT, IMPORT_OBJECT_PORT, EVENT_EVIDENCE_READ_PORT, EVENT_REPLAY_PORT],
  workloads: {
    jobs: {
      dependencies: ['identity', 'checkout', 'pricing', 'verification', 'observability'],
      services: ['database.pool', 'object.store'],
      workers: ['outboxrelay', 'scheduler'],
      ports: [OUTBOX_RELAY_PORT, RUNTIME_IMPORT_PORT, JOB_PORT, EXPORT_PORT, IMPORT_BATCH_FACTORY_PORT, IMPORT_RUNNER_PORT, TABULAR_FILE_PORT, EXPORT_RUNNER_PORT, LEASE_PORT, EVENT_REPLAY_PORT],
    },
  },
});
