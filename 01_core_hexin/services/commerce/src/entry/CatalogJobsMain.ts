import type { Job } from '../foundation/application/Job';
import {
  catalogJobsEnvironment,
  createCatalogJobsRuntime,
  type CatalogJobsEnvironment,
  type CatalogJobsRuntime,
} from '../bootstrap/CatalogJobsRuntime';

export async function runCatalogJobs(
  environment: CatalogJobsEnvironment,
  createRuntime: (environment: CatalogJobsEnvironment) => Promise<CatalogJobsRuntime> = createCatalogJobsRuntime,
): Promise<void> {
  const runtime = await createRuntime(environment);
  const controller = new AbortController();
  const stop = (signal: 'SIGINT' | 'SIGTERM') => controller.abort(signal);
  for (const signal of ['SIGINT', 'SIGTERM'] as const) process.once(signal, stop);
  const tasks = runtime.jobs.map((job: Job<void>) => job.execute(undefined, {
    id: job.id,
    attempt: 1,
    signal: controller.signal,
  }));
  process.stdout.write('ZHUDATUAN_CATALOG_JOBS_READY\n');
  try {
    await Promise.all(tasks);
  } finally {
    controller.abort('catalog-jobs-runtime-stopped');
    await Promise.allSettled(tasks);
    for (const signal of ['SIGINT', 'SIGTERM'] as const) process.removeListener(signal, stop);
    await runtime.close();
  }
}

await runCatalogJobs(catalogJobsEnvironment());
