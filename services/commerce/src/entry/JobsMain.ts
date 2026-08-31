import { jobsEnvironment } from '@shop/config/server';
<<<<<<< HEAD
<<<<<<< HEAD
import { runJobs } from './JobsEntrypoint';

await runJobs(jobsEnvironment());
=======
import { bootstrapJobs } from '../bootstrap/JobsBootstrap';
import { createRuntime } from '../bootstrap/CommerceRuntime';
import { JOB_CATALOG } from '../app/jobs';
import { COMMERCE_MODULES } from '../app/modules';
import { OutboxRelay } from '../foundation/infrastructure/OutboxRelay';
import { RuntimeEventPublisher } from '../foundation/infrastructure/RuntimeEventPublisher';
import { RuntimeScheduler } from '../foundation/infrastructure/RuntimeScheduler';
import { assertRuntimeCompatibility } from '../bootstrap/RuntimeCompatibility';

const environment = jobsEnvironment();
const runtime = await createRuntime(environment, 'jobs');
const registry = await bootstrapJobs({ modules: COMMERCE_MODULES, extensions: runtime.extensions, pool: runtime.pool, worker: environment.JOB_WORKER_ID!, configure: runtime.configure });
const controller = new AbortController();

const registeredJobs = registry.all().map(({ id }) => id).sort();
const catalogJobs = JOB_CATALOG.map(({ id }) => id).sort();
if (registeredJobs.join(',') !== catalogJobs.join(',')) throw new Error('JOB_RUNTIME_CATALOG_DRIFT');
await assertRuntimeCompatibility(runtime.pool, runtime.extensions, 'jobs');

for (const signal of ['SIGINT', 'SIGTERM'] as const) process.once(signal, () => controller.abort(signal));
const relay = new OutboxRelay(runtime.pool, new RuntimeEventPublisher(runtime.pool), environment.JOB_WORKER_ID!);
const scheduler = new RuntimeScheduler(runtime.pool, environment.JOB_WORKER_ID!);
await Promise.all([...registry.all().map((definition) => definition.job.execute(undefined, { id: definition.id, attempt: 1, signal: controller.signal })),
  relay.run(controller.signal), scheduler.run(controller.signal)]);
await runtime.close();
>>>>>>> a7d9b2c8 (chore: establish zhudatuan main platform baseline)
=======
import { runJobs } from './JobsEntrypoint';

await runJobs(jobsEnvironment());
>>>>>>> 018b2a71 (chore(release): capture current production source)
