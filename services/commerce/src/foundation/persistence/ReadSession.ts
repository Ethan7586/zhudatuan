import type { PoolClient } from 'pg';
import { applyApiDatabaseContext, applyJobDatabaseContext } from '../infrastructure/DatabaseContext';
import type { DatabasePool } from './Pool';
import type { ReadDatabaseWorkload } from './Workload';

export interface ReadScope {
  readonly tenant: string;
  readonly membership: string;
  readonly scope: string;
  readonly actor: string;
  readonly trace: string;
  readonly operation: string;
}

export class ReadSession {
  private readonly pool: DatabasePool;

  constructor(
    pool: DatabasePool,
    private readonly workload: ReadDatabaseWorkload = 'query'
  ) {
    this.pool = pool.workload(workload);
  }

  async run<T>(scope: ReadScope, read: (database: PoolClient) => Promise<T>): Promise<T> {
    const database = await this.pool.connect();
    try {
      await database.query('begin isolation level repeatable read read only');
      if (this.workload === 'worker') await applyJobDatabaseContext(database, scope.scope);
      else await applyApiDatabaseContext(database, scope);
      const result = await read(database);
      await database.query('commit');
      return result;
    } catch (cause) {
      await database.query('rollback');
      throw cause;
    } finally {
      database.release();
    }
  }
}
