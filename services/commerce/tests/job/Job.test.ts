import type { PoolClient, QueryResult } from 'pg';
import { describe, expect, it, vi } from 'vitest';
import { JobRunner, type ClaimedJob, type JobRunnerConfig } from '../../src/foundation/application/JobRunner';
import type { DatabasePool } from '../../src/foundation/persistence/Pool';

describe('job claim, retry and dead letter', () => {
  it('completes only the job held by the configured lease owner', async () => {
    const abort = new AbortController();
    const fixture = database(job(1));
    const runner = new JobRunner(fixture.pool, configuration(3));
    await runner.run('contractjob', { process: async () => abort.abort() }, abort.signal);
    expect(fixture.sql.some((query) => query.includes("state='completed'") && query.includes('lease_owner=$2'))).toBe(true);
    expect(fixture.values.some((values) => values?.includes('worker-contract'))).toBe(true);
  });

  it('requeues a retryable failure inside one transaction', async () => {
    const abort = new AbortController();
    const fixture = database(job(1));
    const runner = new JobRunner(fixture.pool, configuration(3));
    await runner.run('contractjob', { process: async () => { abort.abort(); throw new Error('DEPENDENCY_TIMEOUT'); } }, abort.signal);
    expect(fixture.sql).toContain('begin');
    expect(fixture.sql).toContain('commit');
    expect(fixture.sql.some((query) => query.includes("state=$3") && fixture.values.some((values) => values?.includes('queued')))).toBe(true);
    expect(fixture.sql.some((query) => query.includes('runtime.deadletter'))).toBe(false);
  });

  it('records a terminal failure and marks the source job failed atomically', async () => {
    const abort = new AbortController();
    const fixture = database(job(3));
    const deadletter = { record: vi.fn(async () => undefined) };
    const runner = new JobRunner(fixture.pool, configuration(3), deadletter);
    await runner.run('contractjob', { process: async () => { abort.abort(); throw new Error('PERMANENT_FAILURE'); } }, abort.signal);
    expect(fixture.sql.some((query) => query.includes('insert into runtime.deadletter'))).toBe(true);
    expect(fixture.values.some((values) => values?.includes('failed'))).toBe(true);
    expect(deadletter.record).toHaveBeenCalledOnce();
    expect(fixture.sql).toContain('commit');
  });
});

function configuration(attempts: number): JobRunnerConfig {
  return { worker: 'worker-contract', owner: 'runtime', batch: 1, lease: 5, concurrency: 1, attempts, poll: 1,
    deadline: 1_000, retryMinimum: 1, retryMaximum: 2 };
}

function job(attempts: number): ClaimedJob {
  return { id: 'job-contract', kind: 'contractjob', scope_id: 'mall-contract', payload: {}, attempts };
}

function database(claimed: ClaimedJob) {
  const sql: string[] = [];
  const values: (readonly unknown[] | undefined)[] = [];
  let claims = 0;
  const client = {
    query: async (text: string, parameters?: readonly unknown[]) => {
      sql.push(text.trim()); values.push(parameters);
      return { rows: [], rowCount: 1 } as unknown as QueryResult;
    },
    release: () => undefined,
  } as unknown as PoolClient;
  const pool = {
    connect: async () => client,
    query: async <T>(text: string, parameters?: readonly unknown[]) => {
      sql.push(text.trim()); values.push(parameters);
      if (text.includes('runtime.claim_job')) return { rows: claims++ === 0 ? [claimed] : [], rowCount: claims === 1 ? 1 : 0 } as unknown as QueryResult<T & never>;
      return { rows: [], rowCount: 1 } as unknown as QueryResult<T & never>;
    },
    workload: () => pool,
    end: async () => undefined,
  } as DatabasePool;
  return { pool, sql, values };
}
