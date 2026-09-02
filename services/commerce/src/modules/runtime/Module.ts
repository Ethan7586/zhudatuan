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
import { ReadinessService } from './application/service/ReadinessService';
import { PgRuntimeRepository } from './infrastructure/persistence/PgRuntimeRepository';
import { Manifest } from './Manifest';
import { createJobs } from './interface/job/JobFactory';
import { OUTBOX_RELAY_PORT } from './public';
import { PgOutboxRelay } from './infrastructure/persistence/PgOutboxRelay';

export const RuntimeModule = defineModule(Manifest, {
  jobs: createJobs,
  jobPorts: [{ token: OUTBOX_RELAY_PORT, value: new PgOutboxRelay() }],
  handlers: (context) => {
    const runtime = new PgRuntimeRepository(new PgTransactionAccess());
    const readiness = new ReadinessService(runtime, context.ports.get(CAPABILITY_READINESS_PORT), context.ports.get(IDENTITY_READINESS_PORT), context.service(EXTENSION_REGISTRY), context.service(INVITATION_KEY_VERSIONS));
    return [new HealthLiveHandler(), new HealthReadyHandler(readiness), new HealthStartupHandler(readiness), new HealthDependencyHandler(runtime, readiness, context.service(CACHE), context.service(QUERY_METRICS))];
  },
});
