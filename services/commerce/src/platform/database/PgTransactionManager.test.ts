import { describe, expect, it, vi } from 'vitest';
import type { QueryResult, QueryResultRow } from 'pg';
import type { DatabasePool } from '../../platform/database/Pool';
import type { ReadTransactionContext } from '../../platform/database/TransactionContext';
import { PgTransactionAccess } from './PgTransactionAccess';
import { PgTransactionManager } from './PgTransactionManager';

describe('PgTransactionManager', () => {
  it('issues an opaque read capability and invalidates it after commit', async () => {
    const client = fakeClient();
    const manager = new PgTransactionManager(fakePool(client));
    const access = new PgTransactionAccess();
    let retained: ReadTransactionContext | undefined;

    await manager.read(options(), async (context) => {
      retained = context;
      await access.database(context).query('select 1');
    });

    expect(client.statements[0]).toBe('begin read only');
    expect(client.statements).toContain('select 1');
    expect(client.statements.at(-1)).toBe('commit');
    expect(Number(client.parameters.find(({ text }) => text.startsWith('select set_config('))?.values?.[8])).toBeGreaterThan(0);
    expect(Number(client.parameters.find(({ text }) => text.startsWith('select set_config('))?.values?.[8])).toBeLessThanOrEqual(10_000);
    expect(client.release).toHaveBeenCalledOnce();
    expect(() => access.database(retained!)).toThrow('TRANSACTION_CONTEXT_INACTIVE');
  });

  it('rejects writes through a read capability', async () => {
    const manager = new PgTransactionManager(fakePool(fakeClient()));
    const access = new PgTransactionAccess();
    await expect(manager.read(options(), (context) => access.database(context).query('update catalog.product set status=$1', ['active']))).rejects.toThrow('READ_TRANSACTION_WRITE_FORBIDDEN');
  });

  it('rejects forged and mismatched nested contexts', async () => {
    const manager = new PgTransactionManager(fakePool(fakeClient()));
    const access = new PgTransactionAccess();
    await manager.read(options(), async (context) => {
      expect(() => access.database(Object.freeze({ ...context }) as ReadTransactionContext)).toThrow('TRANSACTION_CONTEXT_FORGED');
      await expect(manager.read({ ...options(), operation: 'runtime.health.ready' }, async () => undefined)).rejects.toThrow('TRANSACTION_CONTEXT_MISMATCH');
      await expect(manager.write(options(), async () => undefined)).rejects.toThrow('TRANSACTION_MODE_PROMOTION_FORBIDDEN');
    });
  });

  it('joins a compatible read inside a write transaction', async () => {
    const client = fakeClient();
    const manager = new PgTransactionManager(fakePool(client));
    await manager.write(options(), async (outer) => {
      await manager.read(options(), async (inner) => expect(inner).toBe(outer));
    });
    expect(client.statements.filter((statement) => statement.startsWith('begin'))).toEqual(['begin isolation level serializable']);
  });

  it('retries serialization failures with a bounded delay', async () => {
    const first = fakeClient();
    const second = fakeClient();
    const sleeps: number[] = [];
    const manager = new PgTransactionManager(
      fakePool(first, second),
      async (milliseconds) => {
        sleeps.push(milliseconds);
      },
      () => 0
    );
    let attempts = 0;
    await manager.write(options(), async () => {
      attempts += 1;
      if (attempts === 1) throw Object.assign(new Error('serialization'), { code: '40001' });
    });
    expect(attempts).toBe(2);
    expect(sleeps).toEqual([7]);
    expect(first.statements).toContain('rollback');
    expect(second.statements).toContain('commit');
  });

  it('absorbs synchronized worker claim conflicts without weakening API transaction bounds', async () => {
    const clients = Array.from({ length: 8 }, () => fakeClient());
    const sleeps: number[] = [];
    const manager = new PgTransactionManager(
      fakePool(...clients),
      async (milliseconds) => {
        sleeps.push(milliseconds);
      },
      () => 0
    );
    let attempts = 0;
    await manager.write({ ...options(), workload: 'jobs' }, async () => {
      attempts += 1;
      if (attempts < 8) throw Object.assign(new Error('serialization'), { code: '40001' });
    });
    expect(attempts).toBe(8);
    expect(sleeps).toEqual([7, 14, 28, 56, 100, 100, 100]);
    expect(clients.slice(0, -1).every((client) => client.statements.includes('rollback'))).toBe(true);
    expect(clients.at(-1)?.statements).toContain('commit');
  });

  it('does not begin work when the caller is cancelled while waiting for a connection', async () => {
    const client = fakeClient();
    const controller = new AbortController();
    const base = fakePool(client);
    const pool = {
      ...base,
      workload: () => pool,
      connect: async () => {
        controller.abort(new Error('CALLER_ABORTED'));
        return client;
      },
    } as unknown as DatabasePool;
    const manager = new PgTransactionManager(pool);

    await expect(manager.read({ ...options(), signal: controller.signal }, async () => undefined)).rejects.toThrow('CALLER_ABORTED');
    expect(client.statements).toEqual([]);
    expect(client.release).toHaveBeenCalledOnce();
  });
});

function options() {
  return {
    tenant: 'tenant:1',
    membership: 'membership:1',
    scope: 'scope:1',
    actor: 'actor:1',
    trace: 'trace:1',
    operation: 'runtime.health.live' as const,
    deadline: Date.now() + 10_000,
    signal: new AbortController().signal,
  };
}

function fakePool(...clients: ReturnType<typeof fakeClient>[]): DatabasePool {
  const queue = [...clients];
  const pool = {
    connect: async () => {
      const client = queue.shift();
      if (!client) throw new Error('TEST_CLIENT_MISSING');
      return client;
    },
    query: async <R extends QueryResultRow>() => result<R>(),
    workload: () => pool,
    end: async () => undefined,
  };
  return pool as unknown as DatabasePool;
}

function fakeClient() {
  const statements: string[] = [];
  const parameters: Array<{ text: string; values: readonly unknown[] | undefined }> = [];
  return {
    statements,
    parameters,
    release: vi.fn(),
    query: async <R extends QueryResultRow>(text: string, values?: readonly unknown[]): Promise<QueryResult<R>> => {
      statements.push(text);
      parameters.push({ text, values });
      return result<R>();
    },
  };
}

function result<R extends QueryResultRow>(): QueryResult<R> {
  return { rows: [], rowCount: 0, command: '', oid: 0, fields: [] };
}
