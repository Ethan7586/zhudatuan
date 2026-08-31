import type { JobsEnvironment } from '@shop/config/server';
import { createIdentityNotificationJobsRuntime } from '../bootstrap/IdentityNotificationJobsRuntime';

export async function runIdentityNotificationJobs(environment: JobsEnvironment): Promise<void> {
  const runtime = await createIdentityNotificationJobsRuntime(environment);
  const controller = new AbortController();
  const stop = (signal: 'SIGINT' | 'SIGTERM') => controller.abort(signal);
  for (const signal of ['SIGINT', 'SIGTERM'] as const) process.once(signal, stop);
  try {
    await runtime.job.execute(undefined, { id: 'identitynotification', attempt: 1, signal: controller.signal });
  } finally {
    for (const signal of ['SIGINT', 'SIGTERM'] as const) process.removeListener(signal, stop);
    await runtime.close();
  }
}
