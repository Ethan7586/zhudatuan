import { describe, expect, it } from 'vitest';
import type { PoolClient, QueryResult } from 'pg';
import type { DatabasePool } from '../../../../platform/database/Pool';
import type { DatabaseWorkload } from '../../../../platform/database/QueryMetrics';
import { loadProviders } from './RuntimeExtensionLoader';

describe('provider loader database workload', () => {
  it('loads provider installations through the worker pool', async () => {
    const workloads: DatabaseWorkload[] = [];
    const client = {
      query: async (text: string) => result(text.includes('extension.enabled_installations') ? [] : []),
      release: () => undefined,
    } as unknown as PoolClient;
    const worker: DatabasePool = {
      connect: async () => client,
      query: async () => result([]),
      workload: () => worker,
      end: async () => undefined,
    } satisfies DatabasePool;
    const pool = {
      ...worker,
      workload(workload: DatabaseWorkload) {
        workloads.push(workload);
        if (workload !== 'worker') throw new Error(`unexpected workload: ${workload}`);
        return worker;
      },
    } satisfies DatabasePool;

    await loadProviders(pool, {} as never, {} as never);

    expect(workloads).toEqual(['worker']);
  });
});

function result(rows: unknown[]): QueryResult {
  return { rows, rowCount: rows.length, command: '', oid: 0, fields: [] } as unknown as QueryResult;
}
