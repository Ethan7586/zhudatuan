import { describe, expect, it, vi } from 'vitest';
import type { Job } from '../foundation/application/Job';
import type { PaymentJobsRuntime } from '../bootstrap/PaymentJobsRuntime';
import { runPaymentJobs } from './PaymentJobsMain';

describe('payment Jobs entrypoint', () => {
  it('announces readiness, aborts sibling workers, and closes the runtime on exit', async () => {
    const closed = vi.fn(async () => undefined);
    const secondStopped = vi.fn();
    const jobs: readonly Job<void>[] = [
      job('paymentquery', async () => { throw new Error('TEST_STOP'); }),
      job('paymentrefund', async (_input, context) => new Promise<void>((resolve) => {
        context.signal.addEventListener('abort', () => { secondStopped(); resolve(); }, { once: true });
      })),
    ];
    const runtime: PaymentJobsRuntime = { jobs, manifest: {} as PaymentJobsRuntime['manifest'], close: closed };
    const output = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);
    await expect(runPaymentJobs({}, async () => runtime)).rejects.toThrow('TEST_STOP');
    expect(output).toHaveBeenCalledWith('ZHUDATUAN_PAYMENT_JOBS_READY\n');
    expect(secondStopped).toHaveBeenCalledOnce();
    expect(closed).toHaveBeenCalledOnce();
    output.mockRestore();
  });
});

function job(id: string, execute: Job<void>['execute']): Job<void> {
  return { id, execute };
}
