import { jobsEnvironment } from '@shop/config/server';
import { bootstrapJobs } from '../bootstrap/JobsBootstrap';
import { createRuntime } from '../bootstrap/CommerceRuntime';
import { assertRuntimeReady } from '../bootstrap/RuntimeReadiness';
import { ORDINARY_JOB_CATALOG } from '../foundation/application/JobCatalog';
import { COMMERCE_MODULES } from './modules';
import { mapParallel } from '../foundation/performance/Parallel';

const environment = jobsEnvironment();
const runtime = await createRuntime(environment, 'jobs');
const worker = environment.JOB_WORKER_ID!;
const registries = await bootstrapJobs({ modules: COMMERCE_MODULES, extensions: runtime.extensions, pool: runtime.pool, worker, configure: runtime.configure });
const registered = registries.jobs
  .all()
  .map(({ id }) => id)
  .sort();
const expected = ORDINARY_JOB_CATALOG.map(({ id }) => id).sort();
if (registered.join(',') !== expected.join(',')) throw new Error('JOB_RUNTIME_CATALOG_DRIFT');
await assertRuntimeReady(runtime.pool, runtime.extensions, 'jobs', runtime.invitationKeyVersions);

const controller = new AbortController();
for (const signal of ['SIGINT', 'SIGTERM'] as const) process.once(signal, () => controller.abort(signal));
const runners = [
  ...registries.jobs.all().map((definition) => () => definition.job.execute(undefined, { id: definition.id, attempt: 1, signal: controller.signal })),
  ...registries.workers.all().map(({ worker: technical }) => () => technical.run(controller.signal)),
];
await mapParallel(runners, runners.length, (runner) => runner());
await runtime.close();
