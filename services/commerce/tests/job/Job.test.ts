import type { PoolClient, QueryResult } from 'pg';
import { describe, expect, it, vi } from 'vitest';
import { RunJob } from '../../src/modules/runtime/application/process/RunJob';
import type { ClaimedJob, JobRunnerConfig } from '../../src/modules/runtime/public/JobProcess';
import type { DatabasePool } from '../../src/platform/database/Pool';
import { PgTransactionManager } from '../../src/platform/database/PgTransactionManager';
import { PgJobQueue } from '../../src/modules/runtime/infrastructure/persistence/PgJobQueue';
import { PgDeadletterStore } from '../../src/platform/database/PgDeadletterStore';
import { DomainError } from '../../src/platform/error/DomainError';

describe('job claim, retry and dead letter', () => {
  it('completes only the job held by the configured lease owner', async () => {
    const abort = new AbortController();
    const fixture = database(job(1));
    const runner = runnerFor(fixture.pool, configuration(3));
    await runner.execute('contractjob', { process: async () => abort.abort() }, abort.signal);
    expect(fixture.sql.some((query) => query.includes("state='succeeded'") && query.includes('lease_owner=$2'))).toBe(true);
    expect(fixture.values.some((values) => values?.includes('worker-contract'))).toBe(true);
  });

  it('requeues a retryable failure inside one transaction', async () => {
    const abort = new AbortController();
    const fixture = database(job(1));
    const runner = runnerFor(fixture.pool, configuration(3));
    await runner.execute(
      'contractjob',
      {
        process: async () => {
          abort.abort();
          throw new Error('DEPENDENCY_TIMEOUT');
        },
      },
      abort.signal
    );
    expect(fixture.sql.some((query) => query.startsWith('begin'))).toBe(true);
    expect(fixture.sql).toContain('commit');
    expect(fixture.sql.some((query) => query.includes('state=$3') && fixture.values.some((values) => values?.includes('queued')))).toBe(true);
    expect(fixture.sql.some((query) => query.includes('runtime.deadletter'))).toBe(false);
  });

  it('records a terminal failure and marks the source job failed atomically', async () => {
    const abort = new AbortController();
    const fixture = database(job(3));
    const deadletter = { record: vi.fn(async () => undefined) };
    const runner = runnerFor(fixture.pool, configuration(3), deadletter);
    await runner.execute(
      'contractjob',
      {
        process: async () => {
          abort.abort();
          throw new Error('PERMANENT_FAILURE');
        },
      },
      abort.signal
    );
    expect(fixture.sql.some((query) => query.includes('insert into runtime.deadletter'))).toBe(true);
    expect(fixture.values.some((values) => values?.includes('deadlettered'))).toBe(true);
    expect(deadletter.record).toHaveBeenCalledOnce();
    expect(fixture.sql).toContain('commit');
  });

  it('rechecks user authorization and cancels the leased attempt before business processing', async () => {
    const abort = new AbortController();
    const claimed = { ...job(1), authorization: { kind: 'user', actor: 'principal:one', scope: 'mall-contract' } };
    const fixture = database(claimed);
    const process = vi.fn(async () => undefined);
    const authorization = { assert: vi.fn(async () => { abort.abort(); throw new DomainError('AUTHORIZATION_DENIED'); }) };
    const runner = runnerFor(fixture.pool, configuration(3), undefined, authorization);
    await runner.execute('contractjob', { process }, abort.signal);
    expect(authorization.assert).toHaveBeenCalledOnce();
    expect(process).not.toHaveBeenCalled();
    expect(fixture.sql.some((query) => query.includes("state='cancelled'") && query.includes("'AUTHORIZATION_DENIED'"))).toBe(true);
  });
});

function configuration(attempts: number): JobRunnerConfig {
  return { worker: 'worker-contract', workload: 'jobs', owner: 'runtime', queue: 'maintenance', batch: 1, lease: 5, concurrency: 1, attempts, poll: 1, deadline: 1_000, retryMinimum: 1, retryMaximum: 2 };
}

function runnerFor(pool: DatabasePool, config: JobRunnerConfig, deadletter?: ConstructorParameters<typeof RunJob>[5], authorization = { assert: async () => undefined }) {
  return new RunJob(new PgTransactionManager(pool), new PgJobQueue(), new PgDeadletterStore(), config,
    authorization, deadletter);
}

function job(attempts: number): ClaimedJob {
  return { id: 'job:contract', kind: 'contractjob', scope: 'mall-contract', payload: {}, attempts, token: 1,
    authorization: { kind: 'system', actor: 'test', scope: 'mall-contract', operation: 'test', source: 'jobs', capturedAt: new Date().toISOString() } };
}

function database(claimed: ClaimedJob) {
  const sql: string[] = [];
  const values: (readonly unknown[] | undefined)[] = [];
  let claims = 0;
  const query = async <T>(text: string, parameters?: readonly unknown[]) => {
    sql.push(text.trim());
    values.push(parameters);
    if (text.includes('runtime.claim_job')) {
      const row = { id: claimed.id, kind: claimed.kind, scope_id: claimed.scope, payload: claimed.payload,
        authorization_snapshot: claimed.authorization, attempts: claimed.attempts, fencing_token: claimed.token };
      return { rows: claims++ === 0 ? [row] : [], rowCount: claims === 1 ? 1 : 0 } as unknown as QueryResult<T & never>;
    }
    if (text.includes("count(*) filter(where state='running'") && text.includes("count(*) filter(where state='queued'")) {
      return { rows: [{ active: 0, queued: 1 }], rowCount: 1 } as unknown as QueryResult<T & never>;
    }
    return { rows: [], rowCount: 1 } as unknown as QueryResult;
  };
  const client = {
    query,
    release: () => undefined,
  } as unknown as PoolClient;
  const pool = {
    connect: async () => client,
    query,
    workload: () => pool,
    end: async () => undefined,
  } as DatabasePool;
  return { pool, sql, values };
}
