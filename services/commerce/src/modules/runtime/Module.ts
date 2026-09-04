import { defineModule } from '../../bootstrap/DefinedModule';
import { EXTENSION_REGISTRY } from '../../bootstrap/ExtensionRegistry';
import { PgTransactionAccess } from '../../adapter/database/PgTransactionAccess';
import { CACHE } from '../../foundation/cache/Cache';
import { INVITATION_KEY_VERSIONS } from '../../foundation/infrastructure/SecretStore';
import { QUERY_METRICS } from '../../foundation/persistence/QueryMetrics';
import { CAPABILITY_READINESS_PORT } from '../capability/public/ReadinessPort';
import { IDENTITY_READINESS_PORT } from '../identity/public/ReadinessPort';
import { HealthDependencyHandler } from './application/handler/HealthDependencyHandler';
import { HealthLiveHandler } from './application/handler/HealthLiveHandler';
import { HealthReadyHandler } from './application/handler/HealthReadyHandler';
import { HealthStartupHandler } from './application/handler/HealthStartupHandler';
import { EvaluateReadiness } from './application/service/EvaluateReadiness';
import { PgRuntimeRepository } from './infrastructure/persistence/PgRuntimeRepository';
import { Manifest } from './Manifest';
import { createJobs } from './interface/job/JobFactory';
import { EVENT_EVIDENCE_READ_PORT, EVENT_REPLAY_PORT, EXPORT_RUNNER_PORT, IMPORT_BATCH_FACTORY_PORT, IMPORT_OBJECT_PORT, IMPORT_RUNNER_PORT, LEASE_PORT, OUTBOX_RELAY_PORT, TABULAR_FILE_PORT } from './public';
import { PgOutboxRelay } from './infrastructure/persistence/PgOutboxRelay';
import { RUNTIME_IMPORT_PORT } from './public/ImportPort';
import { PgRuntimeImporting } from './infrastructure/persistence/PgRuntimeImporting';
import { JOB_PORT, EXPORT_PORT } from './public';
import { PgJobPort } from './infrastructure/persistence/PgJobPort';
import { PgExportPort } from './infrastructure/persistence/PgExportPort';
import { PgJobScheduler } from '../../adapter/database/PgJobScheduler';
import { OBJECT_STORE } from '../runtime/public/ObjectPort';
import { ExportsCancelHandler } from './application/handler/ExportsCancelHandler';
import { ExportsReadHandler } from './application/handler/ExportsReadHandler';
import { ImportsCreateHandler } from './application/handler/ImportsCreateHandler';
import { ImportsConfirmHandler } from './application/handler/ImportsConfirmHandler';
import { ImportsReadHandler } from './application/handler/ImportsReadHandler';
import { ImportsRetryHandler } from './application/handler/ImportsRetryHandler';
import { JobsCancelHandler } from './application/handler/JobsCancelHandler';
import { JobsReadHandler } from './application/handler/JobsReadHandler';
import { ImportRegistry } from './application/registry/ImportRegistry';
import { PgTaskRepository } from './infrastructure/persistence/PgTaskRepository';
import { UploadsCreateHandler } from './application/handler/UploadsCreateHandler';
import { UploadSession } from './infrastructure/storage/UploadSession';
import { RuntimeImportExecution } from './infrastructure/process/ImportExecution';
import { RuntimeExportExecution } from './infrastructure/process/ExportExecution';
import { JobLease } from './infrastructure/queue/JobLease';
import { DATABASE_POOL } from '../../foundation/persistence/Pool';
import { PrepareImportObject } from './application/service/PrepareImportObject';
import { RuntimeTabularFiles } from './infrastructure/storage/RuntimeTabularFiles';
import { PgEventEvidenceReadPort } from './infrastructure/persistence/PgEventEvidenceReadPort';
import { PgEventReplayPort } from './infrastructure/persistence/PgEventReplayPort';
import { createWorkers } from './infrastructure/queue/WorkerFactory';

export const RuntimeModule = defineModule(Manifest, {
  jobs: createJobs,
  workers: createWorkers,
  ports: (context) => [{ token: RUNTIME_IMPORT_PORT, value: new PgRuntimeImporting() }, { token: JOB_PORT, value: new PgJobPort() }, { token: EXPORT_PORT, value: new PgExportPort() },
    { token: IMPORT_OBJECT_PORT, value: new PrepareImportObject(context.service(OBJECT_STORE)) },
    { token: EVENT_EVIDENCE_READ_PORT, value: new PgEventEvidenceReadPort() },
    { token: EVENT_REPLAY_PORT, value: new PgEventReplayPort() }],
  jobPorts: (context) => {
    const execution = new RuntimeImportExecution(context.service(OBJECT_STORE));
    const exporting = new RuntimeExportExecution(context.service(OBJECT_STORE));
    return [{ token: OUTBOX_RELAY_PORT, value: new PgOutboxRelay() }, { token: RUNTIME_IMPORT_PORT, value: new PgRuntimeImporting() }, { token: JOB_PORT, value: new PgJobPort() }, { token: EXPORT_PORT, value: new PgExportPort() },
      { token: IMPORT_BATCH_FACTORY_PORT, value: execution }, { token: IMPORT_RUNNER_PORT, value: execution },
      { token: TABULAR_FILE_PORT, value: new RuntimeTabularFiles(context.service(OBJECT_STORE)) },
      { token: EXPORT_RUNNER_PORT, value: exporting }, { token: LEASE_PORT, value: new JobLease(context.service(DATABASE_POOL)) },
      { token: EVENT_REPLAY_PORT, value: new PgEventReplayPort() }];
  },
  handlers: (context) => {
    const transactions = new PgTransactionAccess();
    const runtime = new PgRuntimeRepository(transactions);
    const readiness = new EvaluateReadiness(runtime, context.ports.get(CAPABILITY_READINESS_PORT), context.ports.get(IDENTITY_READINESS_PORT), context.service(EXTENSION_REGISTRY), context.service(INVITATION_KEY_VERSIONS));
    const tasks = new PgTaskRepository(transactions);
    const imports = new PgRuntimeImporting(transactions);
    const scheduler = new PgJobScheduler(transactions);
    const importRegistry = new ImportRegistry();
    const importObjects = context.ports.get(IMPORT_OBJECT_PORT);
    return [
      new HealthLiveHandler(),
      new HealthReadyHandler(readiness),
      new HealthStartupHandler(readiness),
      new HealthDependencyHandler(runtime, readiness, context.service(CACHE), context.service(QUERY_METRICS)),
      new JobsReadHandler(tasks),
      new JobsCancelHandler(tasks),
      new UploadsCreateHandler(new UploadSession(context.service(OBJECT_STORE))),
      new ImportsCreateHandler(imports, tasks, scheduler, importObjects, importRegistry),
      new ImportsReadHandler(tasks),
      new ImportsConfirmHandler(tasks, scheduler, importRegistry),
      new ImportsRetryHandler(tasks, scheduler, importRegistry),
      new ExportsReadHandler(tasks),
      new ExportsCancelHandler(tasks),
    ];
  },
});
