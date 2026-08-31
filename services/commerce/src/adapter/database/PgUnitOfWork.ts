import { AsyncLocalStorage } from 'node:async_hooks';
import type { TransactionContext, UnitOfWork } from '../../foundation/persistence/UnitOfWork';
import type { Transaction } from '../../foundation/persistence/UnitOfWork';
import type { DatabasePool } from '../../foundation/persistence/Pool';
import { PgContext } from '../../foundation/infrastructure/PgContext';

export class PgUnitOfWork implements UnitOfWork {
  private static readonly active = new AsyncLocalStorage<Readonly<{ transaction: Transaction; context: TransactionContext }>>();

  constructor(
    private readonly pool: DatabasePool,
    private readonly context = new PgContext()
  ) {}

  async execute<T>(values: TransactionContext, operation: Parameters<UnitOfWork['execute']>[1]): Promise<T> {
    const joined = PgUnitOfWork.active.getStore();
    if (joined) {
      if (joined.context.tenant !== values.tenant || joined.context.scope !== values.scope) throw new Error('TRANSACTION_CONTEXT_SCOPE_MISMATCH');
      return operation(joined.transaction) as Promise<T>;
    }
    const attempts = values.workload === 'command' ? 4 : 1;
    for (let attempt = 1; attempt <= attempts; attempt += 1) {
      const client = await this.pool.connect();
      try {
        await client.query(values.workload === 'command' ? 'begin isolation level serializable' : 'begin');
        await this.context.apply(client, values);
        const result = await PgUnitOfWork.active.run(Object.freeze({ transaction: client, context: values }), () => operation(client));
        await client.query('commit');
        return result as T;
      } catch (cause) {
        await client.query('rollback');
        if (attempt === attempts || !retryable(cause)) throw cause;
        await delay(attempt * 7);
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

function delay(milliseconds: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}
