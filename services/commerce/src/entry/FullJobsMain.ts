import type { JobsEnvironment } from '@shop/config/server';
import { bootstrapJobs } from '../bootstrap/JobsBootstrap';
import { createRuntime } from '../bootstrap/CommerceRuntime';
import { JOB_CATALOG } from '../app/jobs';
import { COMMERCE_MODULES } from '../app/modules';
import { OutboxRelay } from '../foundation/infrastructure/OutboxRelay';
import { RuntimeEventPublisher } from '../foundation/infrastructure/RuntimeEventPublisher';
import { RuntimeScheduler } from '../foundation/infrastructure/RuntimeScheduler';
import { assertRuntimeCompatibility } from '../bootstrap/RuntimeCompatibility';

export async function runFullJobs(environment: JobsEnvironment): Promise<void> {
  const runtime = await createRuntime(environment, 'jobs');
  const controller = new AbortController();
  let cacheFailed = false;
  const stopOnCacheFailure = runtime.cache.onUnavailable(() => {
    cacheFailed = true;
    controller.abort('CACHE_UNAVAILABLE');
  });
  try {
    const registry = await bootstrapJobs({ modules: COMMERCE_MODULES, extensions: runtime.extensions, pool: runtime.pool,
      worker: environment.JOB_WORKER_ID!, configure: runtime.configure });
    const registeredJobs = registry.all().map(({ id }) => id).sort();
    const catalogJobs = JOB_CATALOG.map(({ id }) => id).sort();
    if (registeredJobs.join(',') !== catalogJobs.join(',')) console.warn('JOB_RUNTIME_CATALOG_DRIFT');
    await assertRuntimeCompatibility(runtime.pool, runtime.extensions, 'jobs', runtime.cache.state())
      .catch((cause: unknown) => console.warn('RUNTIME_COMPATIBILITY_WARNING', cause));
    for (const signal of ['SIGINT', 'SIGTERM'] as const) process.once(signal, () => controller.abort(signal));
    const relay = new OutboxRelay(runtime.pool, new RuntimeEventPublisher(runtime.pool), environment.JOB_WORKER_ID!);
    const scheduler = new RuntimeScheduler(runtime.pool, environment.JOB_WORKER_ID!);
    await Promise.all([...registry.all().map((definition) => definition.job.execute(undefined,
      { id: definition.id, attempt: 1, signal: controller.signal })), relay.run(controller.signal), scheduler.run(controller.signal)]);
    if (cacheFailed) throw new Error('FULL_JOBS_CACHE_BECAME_UNAVAILABLE');
  } finally {
    stopOnCacheFailure();
    await runtime.close();
  }
}
