import type { QueryResult, QueryResultRow } from 'pg';
import { describe, expect, it, vi } from 'vitest';
import type { DatabasePool } from '../../../../platform/database/Pool';
import { RiskCheckAdapter } from './RiskCheckAdapter';

describe('RiskCheckAdapter', () => {
  it('proves the absence of active policies with one contextual query and skips a transaction', async () => {
    const query = vi.fn(async () => result([]));
    const connect = vi.fn();
    const pool = databasePool(query, connect);
    const gate = new RiskCheckAdapter(pool, pool);

    await expect(
      gate.evaluate({
        actor: { id: 'principal:one', session: 'session:one', membership: 'membership:one', credentialVersion: 1, accessVersion: 1, target: 'storefront', assurance: { level: 1 } },
        operation: 'member.profile.read',
        scope: { kind: 'owner', id: 'member:one', tenant: 'tenant:one', path: [] },
        trace: 'trace:one',
        deadline: Date.now() + 10_000,
        signal: new AbortController().signal,
      })
    ).resolves.toEqual({ outcome: 'allow', safeReason: 'policy', decision: null });

    expect(query).toHaveBeenCalledOnce();
    const [statement] = query.mock.calls[0] as unknown as [string, readonly unknown[]];
    expect(statement).toContain('with request_context as materialized');
    expect(statement).toContain('from request_context cross join risk.policy');
    expect(connect).not.toHaveBeenCalled();
  });
});

function databasePool(query: ReturnType<typeof vi.fn>, connect: ReturnType<typeof vi.fn>): DatabasePool {
  const pool = { connect, query, workload: vi.fn(), end: vi.fn() } as unknown as DatabasePool;
  vi.mocked(pool.workload).mockReturnValue(pool);
  return pool;
}

function result<R extends QueryResultRow>(rows: readonly R[]): QueryResult<R> {
  return { rows: [...rows], rowCount: rows.length, command: '', oid: 0, fields: [] };
}
