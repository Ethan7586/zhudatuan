import { describe, expect, it, vi } from 'vitest';
import { result, transactionManager } from '../../../../test/TransactionFixture';
import type { DeadletterStore } from '../../../../pipeline/DeadletterStore';
import type { ClaimedJob, JobQueuePort, JobRunnerConfig } from '../../public/JobProcess';
import { RunJob } from './RunJob';

describe('runtime job execution recovery', () => {
  it('turns a crashed processor into a retry without losing the claimed receipt', async () => {
    const controller = new AbortController();
    const queue = queuePort(controller);
    const deadletters = { record: vi.fn(async () => undefined) } satisfies DeadletterStore;
    const runner = new RunJob(
      transactionManager(async () => result([])),
      queue,
      deadletters,
      config(),
      { assert: vi.fn() }
    );
    await runner.execute(
      'catalogimport',
      {
        process: async () => {
          throw new Error('DATABASE_UNAVAILABLE');
        },
      },
      controller.signal
    );
    expect(queue.fail).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ id: 'job:one', token: 7 }), 'worker-one', false, expect.any(Number), 'DATABASE_UNAVAILABLE');
    expect(deadletters.record).not.toHaveBeenCalled();
  });

  it('records permanent processor corruption once before deadletter settlement', async () => {
    const controller = new AbortController();
    const queue = queuePort(controller, { ...job(), attempts: 8 });
    const deadletters = { record: vi.fn(async () => undefined) } satisfies DeadletterStore;
    const domainDeadletter = { record: vi.fn(async () => undefined) };
    const runner = new RunJob(
      transactionManager(async () => result([])),
      queue,
      deadletters,
      config(),
      { assert: vi.fn() },
      domainDeadletter
    );
    await runner.execute(
      'catalogimport',
      {
        process: async () => {
          throw new Error('JOB_PAYLOAD_INVALID');
        },
      },
      controller.signal
    );
    expect(deadletters.record).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ source: 'job:one', attempts: 8, error: 'JOB_PAYLOAD_INVALID' }));
    expect(domainDeadletter.record).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ id: 'job:one' }), 'JOB_PAYLOAD_INVALID');
    expect(queue.fail).toHaveBeenCalledWith(expect.anything(), expect.anything(), 'worker-one', true, 0, 'JOB_PAYLOAD_INVALID');
  });
});

function queuePort(controller: AbortController, claimed: ClaimedJob = job()): JobQueuePort & { fail: ReturnType<typeof vi.fn> } {
  let delivered = false;
  return {
    claim: vi.fn(async () => (delivered ? [] : ((delivered = true), [claimed]))),
    complete: vi.fn(async () => {
      controller.abort();
    }),
    heartbeat: vi.fn(async () => true),
    rejectAuthorization: vi.fn(async () => {
      controller.abort();
    }),
    fail: vi.fn(async () => {
      controller.abort();
    }),
  };
}

function job(): ClaimedJob {
  return Object.freeze({
    id: 'job:one',
    kind: 'catalogimport',
    scope: 'scope:one',
    payload: { import: 'import:one' },
    attempts: 1,
    token: 7,
    authorization: Object.freeze({ kind: 'system', actor: 'runtime:scheduler', scope: 'scope:one', operation: 'runtime.scheduler', source: 'scheduler', capturedAt: new Date().toISOString() }),
  });
}

function config(): JobRunnerConfig {
  return Object.freeze({ worker: 'worker-one', workload: 'jobs', owner: 'catalog', queue: 'import', batch: 1, lease: 5, concurrency: 1, attempts: 8, poll: 1, deadline: 10_000, retryMinimum: 10, retryMaximum: 100 });
}
