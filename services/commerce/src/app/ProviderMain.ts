import { providerWorkerEnvironment } from '@shop/config/server';
import { mapParallel } from '../foundation/performance/Parallel';
import { bootstrapProvider, assertProviderReady } from '../bootstrap/ProviderBootstrap';
import { createProviderRuntime } from '../bootstrap/ProviderRuntime';
import { PROVIDER_JOB_CATALOG } from './providers';

const environment = providerWorkerEnvironment();
const runtime = await createProviderRuntime(environment);
const worker = environment.PROVIDER_WORKER_ID!;
const jobs = await bootstrapProvider({ extensions: runtime.extensions, worker, configure: runtime.configure });
const registered = jobs
  .all()
  .map(({ id }) => id)
  .sort();
const expected = PROVIDER_JOB_CATALOG.map(({ id }) => id).sort();
if (registered.join(',') !== expected.join(',')) throw new Error('PROVIDER_RUNTIME_CATALOG_DRIFT');
await assertProviderReady(runtime.pool, runtime.extensions);

const controller = new AbortController();
for (const signal of ['SIGINT', 'SIGTERM'] as const) process.once(signal, () => controller.abort(signal));
await mapParallel(jobs.all(), PROVIDER_JOB_CATALOG.length, ({ id, job }) => job.execute(undefined, { id, attempt: 1, signal: controller.signal }));
await runtime.close();
