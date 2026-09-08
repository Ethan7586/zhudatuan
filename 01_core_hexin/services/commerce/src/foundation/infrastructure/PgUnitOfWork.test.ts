import type { PoolClient, QueryResult } from 'pg';
import { describe, expect, it } from 'vitest';
import type { TransactionContext } from '../application/UnitOfWork';
import type { DatabasePool } from '../persistence/Pool';
import { PgContext } from './PgContext';
import { PgUnitOfWork } from './PgUnitOfWork';

const commandContext: TransactionContext = {
  tenant: '', membership: '', scope: 'public:identity', actor: 'public', trace: 'trace:test', workload: 'command',
};

describe('PgUnitOfWork serialization recovery', () => {
  it('retries a command twelve times with a pause between conflicts', async () => {
    const pauses: number[] = [];
    let operations = 0;
    let releases = 0;
    const client = {
      query: async () => ({ rows: [], rowCount: 0 }) as unknown as QueryResult,
      release: () => { releases += 1; },
    } as unknown as PoolClient;
    const pool = { connect: async () => client } as unknown as DatabasePool;
    const context = { apply: async () => undefined };
    const unit = new PgUnitOfWork(pool, context as never, async (attempt) => { pauses.push(attempt); });

    await expect(unit.execute(commandContext, async () => {
      operations += 1;
      if (operations < 12) throw Object.assign(new Error('serialization conflict'), { code: '40001' });
      return 'committed';
    })).resolves.toBe('committed');
    expect(operations).toBe(12);
    expect(pauses).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]);
    expect(releases).toBe(12);
  });
});

describe('PgUnitOfWork command serialization', () => {
  it('locks the audit scope before beginning a serializable command and releases it after commit', async () => {
    const harness = unitOfWorkHarness();

    await expect(harness.unit.execute(commandContext, async () => {
      harness.order.push('execute');
      return 'completed';
    })).resolves.toBe('completed');

    expect(harness.order).toEqual(['lock:audit:public:identity', 'begin', 'context', 'execute', 'commit', 'unlock:audit:public:identity', 'release']);
  });

  it('releases the audit scope after rollback', async () => {
    const harness = unitOfWorkHarness();

    await expect(harness.unit.execute(commandContext, async () => {
      harness.order.push('execute');
      throw new Error('COMMAND_FAILED');
    })).rejects.toThrow('COMMAND_FAILED');

    expect(harness.order).toEqual(['lock:audit:public:identity', 'begin', 'context', 'execute', 'rollback', 'unlock:audit:public:identity', 'release']);
  });

  it('retries serialization failures with a fresh pre-transaction lock each time', async () => {
    const harness = unitOfWorkHarness();
    let executions = 0;

    await expect(harness.unit.execute(commandContext, async () => {
      executions += 1;
      harness.order.push(`execute:${executions}`);
      if (executions < 3) throw Object.assign(new Error('SERIALIZATION_FAILURE'), { code: '40001' });
      return 'completed';
    })).resolves.toBe('completed');

    expect(executions).toBe(3);
    expect(harness.order.filter((entry) => entry.startsWith('lock:'))).toHaveLength(3);
    expect(harness.order.filter((entry) => entry.startsWith('unlock:'))).toHaveLength(3);
    expect(harness.order.filter((entry) => entry === 'release')).toHaveLength(3);
  });

  it('serializes an authenticated command scope before taking its transaction snapshot', async () => {
    const harness = unitOfWorkHarness();

    await harness.unit.execute({ ...commandContext, scope: 'mall:one', actor: 'principal:one' }, async () => {
      harness.order.push('execute');
    });

    expect(harness.order).toEqual(['lock:audit:mall:one', 'begin', 'context', 'execute', 'commit', 'unlock:audit:mall:one', 'release']);
  });

  it('locks shared command resources in stable order before beginning', async () => {
    const harness = unitOfWorkHarness();

    await harness.unit.execute({ ...commandContext, serializationKeys: ['inventory:mall:one', 'audit:public:identity'] }, async () => {
      harness.order.push('execute');
    });

    expect(harness.order).toEqual([
      'lock:audit:public:identity', 'lock:inventory:mall:one', 'begin', 'context', 'execute', 'commit',
      'unlock:inventory:mall:one', 'unlock:audit:public:identity', 'release',
    ]);
  });

  it('queues the same command resource before checking out another database connection', async () => {
    const harness = unitOfWorkHarness();
    let entered!: () => void;
    let unblock!: () => void;
    const firstEntered = new Promise<void>((resolve) => { entered = resolve; });
    const blocked = new Promise<void>((resolve) => { unblock = resolve; });

    const first = harness.unit.execute(commandContext, async () => {
      harness.order.push('execute:first');
      entered();
      await blocked;
    });
    await firstEntered;
    const second = harness.unit.execute(commandContext, async () => { harness.order.push('execute:second'); });
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(harness.order).not.toContain('execute:second');
    expect(harness.order.filter((entry) => entry.startsWith('lock:'))).toHaveLength(1);
    unblock();
    await Promise.all([first, second]);
    expect(harness.order.indexOf('execute:first')).toBeLessThan(harness.order.indexOf('execute:second'));
  });
});

function unitOfWorkHarness(): Readonly<{ unit: PgUnitOfWork; order: string[] }> {
  const order: string[] = [];
  const client = {
    query: async (text: string, values: readonly unknown[] = []) => {
      if (text.startsWith('select pg_advisory_lock')) order.push(`lock:${String(values[0])}`);
      else if (text.startsWith('select pg_advisory_unlock')) {
        order.push(`unlock:${String(values[0])}`);
        return result([{ released: true }]);
      } else if (text.startsWith('begin')) order.push('begin');
      else if (text === 'commit' || text === 'rollback') order.push(text);
      return result([]);
    },
    release: (destroy?: boolean | Error) => order.push(destroy ? 'destroy' : 'release'),
  } as unknown as PoolClient;
  const pool: DatabasePool = {
    connect: async () => client,
    query: async () => result([]),
    workload: () => pool,
    end: async () => undefined,
  };
  const context = { apply: async () => { order.push('context'); return undefined; } } as unknown as PgContext;
  return { unit: new PgUnitOfWork(pool, context, async () => undefined), order };
}

function result(rows: readonly Record<string, unknown>[]): QueryResult {
  return { rows, rowCount: rows.length } as unknown as QueryResult;
}
