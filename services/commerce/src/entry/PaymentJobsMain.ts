import type { JobsEnvironment } from '@shop/config/server';
import { createPaymentJobsRuntime, type PaymentJobsRuntime } from '../bootstrap/PaymentJobsRuntime';

export async function runPaymentJobs(
  environment: JobsEnvironment,
  createRuntime: (environment: JobsEnvironment) => Promise<PaymentJobsRuntime> = createPaymentJobsRuntime,
): Promise<void> {
  const runtime = await createRuntime(environment);
  const controller = new AbortController();
  const stop = (signal: 'SIGINT' | 'SIGTERM') => controller.abort(signal);
  for (const signal of ['SIGINT', 'SIGTERM'] as const) process.once(signal, stop);
  const tasks = runtime.jobs.map((job) => job.execute(undefined, { id: job.id, attempt: 1, signal: controller.signal }));
  process.stdout.write('ZHUDATUAN_PAYMENT_JOBS_READY\n');
  try {
    await Promise.all(tasks);
  } finally {
    controller.abort('payment-jobs-runtime-stopped');
    await Promise.allSettled(tasks);
    for (const signal of ['SIGINT', 'SIGTERM'] as const) process.removeListener(signal, stop);
    await runtime.close();
  }
}
