import type { TransactionContext, UnitOfWork } from '../application/UnitOfWork';
import type { DatabasePool } from '../persistence/Pool';
import { PgContext } from './PgContext';

export class PgUnitOfWork implements UnitOfWork {
  constructor(
    private readonly pool: DatabasePool,
    private readonly context = new PgContext(),
    private readonly pauseBeforeRetry: (attempt: number) => Promise<void> = retryPause,
  ) {}

  async execute<T>(values: TransactionContext, operation: Parameters<UnitOfWork['execute']>[1]): Promise<T> {
    const attempts = values.workload === 'command' ? 12 : 1;
    for (let attempt = 1; attempt <= attempts; attempt += 1) {
      const client = await this.pool.connect();
      try {
        await client.query(values.workload === 'command' ? 'begin isolation level serializable' : 'begin');
        await this.context.apply(client, values);
        const result = await operation(client);
        await client.query('commit');
        return result as T;
      } catch (cause) {
        await client.query('rollback');
        if (attempt === attempts || !retryable(cause)) throw cause;
        await this.pauseBeforeRetry(attempt);
      } finally {
        client.release();
      }
    }
    throw new Error('TRANSACTION_RETRY_EXHAUSTED');
  }
}

function retryable(cause: unknown): boolean {
  return cause !== null && typeof cause === 'object' && 'code' in cause && ['40001', '40P01'].includes(String(cause.code));
}

function retryPause(attempt: number): Promise<void> {
  const base = Math.min(250, 5 * (2 ** (attempt - 1)));
  return new Promise((resolve) => setTimeout(resolve, base + Math.floor(Math.random() * base)));
}
