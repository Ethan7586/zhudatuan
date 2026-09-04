import { describe, expect, it, vi } from 'vitest';
import type { QueryResult } from 'pg';
import { result, withWriteTransaction } from '../../../../test/TransactionFixture';
import type { JobClaim } from '../../public/JobProcess';
import { PgJobQueue } from '../persistence/PgJobQueue';

describe('PgJobQueue', () => {
  it('serializes a concurrency group and clamps SKIP LOCKED claim size to global capacity', async () => {
    const calls: Array<Readonly<{ text: string; values?: readonly unknown[] }>> = [];
    const query = async (text: string, values?: readonly unknown[]) => {
      calls.push({ text, ...(values === undefined ? {} : { values }) });
      if (text.includes("filter(where state='running'")) return result([{ active: 2, queued: 9 }]);
      if (text.includes('runtime.claim_job')) return result([row('job:one', 7), row('job:two', 8)]);
      return result([]);
    };

    const claimed = await withWriteTransaction(query, (context) => new PgJobQueue().claim(context, claim()));

    expect(claimed).toHaveLength(2);
    expect(claimed[0]).toMatchObject({ id: 'job:one', scope: 'mall:one', token: 7, attempts: 2 });
    expect(calls.find(({ text }) => text.includes('pg_advisory_xact_lock'))?.values).toEqual(['runtime:jobgroup:catalogimport']);
    expect(calls.find(({ text }) => text.includes('runtime.claim_job'))?.values).toEqual(['catalogimport', 'worker-one', 2, 30, 'jobs']);
  });

  it('applies backpressure when the global concurrency group has no free slot', async () => {
    const query = vi.fn(async (text: string): Promise<QueryResult> => text.includes("filter(where state='running'") ? result([{ active: 4, queued: 12 }]) : result([]));
    const count = vi.fn();
    const claimed = await withWriteTransaction(query, (context) => new PgJobQueue(undefined, { count, duration: vi.fn() }).claim(context, claim()));
    expect(claimed).toEqual([]);
    expect(query.mock.calls.some(([text]) => String(text).includes('runtime.claim_job'))).toBe(false);
    expect(count).toHaveBeenCalledWith('commerce.queue.depth', 12, expect.objectContaining({ queue: 'import', job: 'catalogimport', result: 'active' }));
  });

  it('rejects malformed claims and corrupt queue records before processing', async () => {
    const query = async (text: string) => {
      if (text.includes("filter(where state='running'")) return result([{ active: 0, queued: 1 }]);
      if (text.includes('runtime.claim_job')) return result([{ ...row('job:one', 1), authorization_snapshot: [] }]);
      return result([]);
    };
    await expect(withWriteTransaction(query, (context) => new PgJobQueue().claim(context, { ...claim(), batch: 0 }))).rejects.toThrow('JOB_CLAIM_ARGUMENT_INVALID');
    await expect(withWriteTransaction(query, (context) => new PgJobQueue().claim(context, claim()))).rejects.toThrow('JOB_QUEUE_RECORD_INVALID');
  });

  it('requires the current fencing token and a live lease for heartbeat, completion and failure settlement', async () => {
    const statements: string[] = [];
    const query = async (text: string) => {
      statements.push(text);
      return result([{ id: 'updated' }]);
    };
    const queue = new PgJobQueue();
    const job = Object.freeze({ id: 'job:one', kind: 'catalogimport', scope: 'mall:one', payload: {}, authorization: {}, attempts: 1, token: 9 });
    await withWriteTransaction(query, async (context) => {
      await queue.heartbeat(context, job, 'worker-one', 30);
      await queue.complete(context, job, 'worker-one');
      await queue.fail(context, job, 'worker-one', false, 100, 'DEPENDENCY_TIMEOUT');
    });
    for (const statement of statements.filter((text) => text.includes('update runtime.jobs'))) {
      expect(statement).toContain('fencing_token');
      expect(statement).toContain('lease_deadline>clock_timestamp()');
    }
  });
});

function claim(): JobClaim {
  return { kind: 'catalogimport', queue: 'import', worker: 'worker-one', workload: 'jobs', batch: 10, lease: 30, concurrency: 4 };
}

function row(id: string, token: number) {
  return { id, kind: 'catalogimport', scope_id: 'mall:one', payload: { import: 'import:one' },
    authorization_snapshot: { kind: 'system' }, attempts: 2, fencing_token: token };
}
