import type { JobsEnvironment } from '@shop/config/server';
import { createIdentityNotificationJobsRuntime } from '../bootstrap/IdentityNotificationJobsRuntime';

export async function runIdentityNotificationJobs(environment: JobsEnvironment): Promise<void> {
  const runtime = await createIdentityNotificationJobsRuntime(environment);
  const controller = new AbortController();
  const stop = (signal: 'SIGINT' | 'SIGTERM') => controller.abort(signal);
  for (const signal of ['SIGINT', 'SIGTERM'] as const) process.once(signal, stop);
  const tasks = [
    runtime.job.execute(undefined, { id: 'identitynotification', attempt: 1, signal: controller.signal }),
    runtime.backlog.run(controller.signal),
  ];
  try {
    await Promise.all(tasks);
  } finally {
    controller.abort('identity-notification-runtime-stopped');
    await Promise.allSettled(tasks);
    for (const signal of ['SIGINT', 'SIGTERM'] as const) process.removeListener(signal, stop);
    await runtime.close();
  }
}
