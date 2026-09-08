import type { PoolClient, QueryResult } from 'pg';
import { describe, expect, it } from 'vitest';
import type { TransactionContext } from '../application/UnitOfWork';
import type { DatabasePool } from '../persistence/Pool';
import { PgUnitOfWork } from './PgUnitOfWork';

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

    await expect(unit.execute(commandContext(), async () => {
      operations += 1;
      if (operations < 12) throw Object.assign(new Error('serialization conflict'), { code: '40001' });
      return 'committed';
    })).resolves.toBe('committed');
    expect(operations).toBe(12);
    expect(pauses).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]);
    expect(releases).toBe(12);
  });
});

function commandContext(): TransactionContext {
  return { workload: 'command', tenant: '', membership: '', scope: '', actor: '', trace: 'sfl95-retry' };
}
