import { providerWorkerEnvironment } from '@shop/config/server';
import { mapParallel } from '@shop/kernel';
import { bootstrapProvider, assertProviderReady } from '../composition/ProviderBootstrap';
import { COMMERCE_MODULES } from '../generated/ModuleCatalog';
import { createProviderRuntime } from '../composition/ProviderRuntime';
import { PROVIDER_JOB_CATALOG } from '../pipeline/JobCatalog';
import { WorkerReadiness } from '../platform/runtime/WorkerReadiness';

const environment = providerWorkerEnvironment();
const runtime = await createProviderRuntime(environment);
const worker = environment.PROVIDER_WORKER_ID!;
const jobs = await bootstrapProvider({ modules: COMMERCE_MODULES, extensions: runtime.extensions, worker, configure: runtime.configure });
const registered = jobs
  .all()
  .map(({ id }) => id)
  .sort();
const expected = PROVIDER_JOB_CATALOG.map(({ id }) => id).sort();
if (registered.join(',') !== expected.join(',')) throw new Error('PROVIDER_RUNTIME_CATALOG_DRIFT');
await assertProviderReady(runtime.pool, runtime.extensions);

const controller = new AbortController();
const readiness = new WorkerReadiness('provider', environment.WORKER_READY_FILE);
readiness.mark();
for (const signal of ['SIGINT', 'SIGTERM'] as const)
  process.once(signal, () => {
    readiness.clear();
    controller.abort(signal);
  });
try {
  await mapParallel(jobs.all(), PROVIDER_JOB_CATALOG.length, ({ id, job }) => job.execute(undefined, { id, attempt: 1, signal: controller.signal }));
} finally {
  readiness.clear();
  await runtime.close();
}
