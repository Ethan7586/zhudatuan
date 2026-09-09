import type { QueryResult } from 'pg';
import { describe, expect, it } from 'vitest';
import type { DatabasePool } from '../persistence/Pool';
import { JobRunner, type ClaimedJob, type JobProcessor, type JobRunnerConfig } from './JobRunner';

describe('node-bound job runner', () => {
  it('claims and completes only jobs from the configured mall scope', async () => {
    const calls: Readonly<{ text: string; values: readonly unknown[] }>[] = [];
    let claimed = false;
    const pool = {
      query: async <Row extends Record<string, unknown>>(text: string, values: readonly unknown[] = []) => {
        calls.push({ text, values });
        if (text.includes('with candidates') && !claimed) {
          claimed = true;
          return result<Row>([{ id: 'job:catalog:1', kind: 'catalogimport', scope_id: 'mall:hongtai', payload: {}, attempts: 1 }]);
        }
        return result<Row>([], text.includes("set state='completed'") ? 1 : 0);
      },
    } as unknown as DatabasePool;
    const controller = new AbortController();
    const processor: JobProcessor = { process: async (_job: ClaimedJob) => { controller.abort(); } };
    const configuration: JobRunnerConfig = {
      worker: 'catalog-l1', owner: 'catalog', batch: 4, lease: 180, concurrency: 1, attempts: 3,
      poll: 1, deadline: 1_000, retryMinimum: 1, retryMaximum: 10, scope: 'mall:hongtai',
    };

    await new JobRunner(pool, configuration).run('catalogimport', processor, controller.signal);

    expect(calls[0]?.text).toContain('kind=$1 and scope_id=$2');
    expect(calls[0]?.text).toContain("state='running' and lease_deadline<=clock_timestamp()");
    expect(calls[0]?.values).toEqual(['catalogimport', 'mall:hongtai', 4, 'catalog-l1', 180]);
    expect(calls.find(({ text }) => text.includes("set state='completed'"))?.values)
      .toEqual(['job:catalog:1', 'catalog-l1', 'mall:hongtai']);
  });
});

function result<Row extends Record<string, unknown>>(rows: readonly Record<string, unknown>[], rowCount = rows.length): QueryResult<Row> {
  return { rows: rows as Row[], rowCount, command: '', oid: 0, fields: [] };
}
