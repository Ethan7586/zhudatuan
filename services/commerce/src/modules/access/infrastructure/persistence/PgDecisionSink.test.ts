import type { QueryResult, QueryResultRow } from 'pg';
import { describe, expect, it, vi } from 'vitest';
import type { DatabasePool } from '../../../../platform/database/Pool';
import type { TransactionManager } from '../../../../platform/database/TransactionManager';
import { PgDecisionSink } from './PgDecisionSink';

describe('PgDecisionSink', () => {
  it('persists a normal decision atomically with its RLS context in one statement', async () => {
    const query = vi.fn(async () => result([]));
    const write = vi.fn();
    const sink = new PgDecisionSink(pool(query), { read: vi.fn(), write } as unknown as TransactionManager, { invalidate: vi.fn() });

    await sink.append({
      actor: { id: 'principal:one', session: 'session:one', membership: 'membership:one', credentialVersion: 1, accessVersion: 1, target: 'console', assurance: { level: 3 } },
      operation: 'order.orders.read',
      scope: { kind: 'mall', id: 'mall:one', tenant: 'tenant:one', path: [] },
      outcome: 'allow',
      reason: 'POLICY_ALLOWED',
      trace: 'trace:one',
      deadline: Date.now() + 10_000,
      signal: new AbortController().signal,
    });

    expect(query).toHaveBeenCalledOnce();
    const [statement, values] = query.mock.calls[0] as unknown as [string, readonly unknown[]];
    expect(statement).toContain('with request_context as materialized');
    expect(statement).toContain('insert into access.decisionaudit');
    expect(values).toHaveLength(17);
    expect(write).not.toHaveBeenCalled();
  });
});

function pool(query: ReturnType<typeof vi.fn>): DatabasePool {
  const value = { connect: vi.fn(), query, workload: vi.fn(), end: vi.fn() } as unknown as DatabasePool;
  vi.mocked(value.workload).mockReturnValue(value);
  return value;
}

function result<R extends QueryResultRow>(rows: readonly R[]): QueryResult<R> {
  return { rows: [...rows], rowCount: rows.length, command: '', oid: 0, fields: [] };
}
