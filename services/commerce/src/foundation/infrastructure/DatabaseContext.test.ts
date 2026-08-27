import { describe, expect, it } from 'vitest';
import type { QueryResult } from 'pg';
import { applyApiDatabaseContext, applyJobDatabaseContext } from './DatabaseContext';

describe('database security context', () => {
  it('maps API transactions to the API RLS workload', async () => {
    const calls: unknown[][] = [];
    const database = { query: async (...values: unknown[]) => {
      calls.push(values);
      return { rows: [], rowCount: 0 } as unknown as QueryResult;
    } };
    await applyApiDatabaseContext(database, { tenant: 'tenant:1', membership: 'membership:1', scope: 'member:1', actor: 'actor:1', trace: 'trace:1' });
    expect(calls[0]?.[0]).toContain("set_config('app.workload','api',true)");
    expect(calls[0]?.[1]).toEqual(['tenant:1','membership:1','member:1','actor:1','trace:1']);
  });

  it('maps background transactions to the jobs RLS workload', async () => {
    const calls: unknown[][] = [];
    const database = { query: async (...values: unknown[]) => {
      calls.push(values);
      return { rows: [], rowCount: 0 } as unknown as QueryResult;
    } };
    await applyJobDatabaseContext(database, 'mall:1');
    expect(calls[0]?.[0]).toContain("set_config('app.workload','jobs',true)");
    expect(calls[0]?.[1]).toEqual(['mall:1']);
  });
});
