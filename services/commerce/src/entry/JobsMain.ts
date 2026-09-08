import { jobsEnvironment } from '@shop/config/server';
import { bootstrapJobs } from '../composition/JobsBootstrap';
import { createApplication } from '../composition/Application';
import { assertRuntimeReady } from '../composition/RuntimeReadiness';
import { ORDINARY_JOB_CATALOG } from '../pipeline/JobCatalog';
import { COMMERCE_MODULES } from '../generated/ModuleCatalog';
import { mapParallel } from '@shop/kernel';
import { WorkerReadiness } from '../platform/runtime/WorkerReadiness';

const environment = jobsEnvironment();
const runtime = await createApplication(environment, 'jobs');
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
const readiness = new WorkerReadiness(environment.WORKER_READY_FILE);
readiness.mark();
for (const signal of ['SIGINT', 'SIGTERM'] as const)
  process.once(signal, () => {
    readiness.clear();
    controller.abort(signal);
  });
const runners = [
  ...registries.jobs.all().map((definition) => () => definition.job.execute(undefined, { id: definition.id, attempt: 1, signal: controller.signal })),
  ...registries.workers.all().map(
    ({ worker: technical }) =>
      () =>
        technical.run(controller.signal)
  ),
];
try {
  await mapParallel(runners, runners.length, (runner) => runner());
} finally {
  readiness.clear();
  await runtime.close();
}
