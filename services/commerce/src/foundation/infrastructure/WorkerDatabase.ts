import type { PoolClient } from 'pg';
import type { DatabasePool } from '../persistence/Pool';
import { applyJobDatabaseContext } from './DatabaseContext';

export async function configureWorker(client: PoolClient, scope: string): Promise<void> {
  await applyJobDatabaseContext(client, scope);
}

export async function workerTransaction<T>(pool: DatabasePool, scope: string, operation: (client: PoolClient) => Promise<T>): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query('begin');
    await configureWorker(client, scope);
    const result = await operation(client);
    await client.query('commit');
    return result;
  } catch (cause) {
    await client.query('rollback');
    throw cause;
  } finally { client.release(); }
}
