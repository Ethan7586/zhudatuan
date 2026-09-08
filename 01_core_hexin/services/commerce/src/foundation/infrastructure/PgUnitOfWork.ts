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
    const serializationKeys = values.workload === 'command'
      ? [...new Set([`audit:${values.scope}`, ...(values.serializationKeys ?? [])])].sort()
      : [];
    const releaseProcessLocks = await acquireProcessLocks(serializationKeys);
    try {
      for (let attempt = 1; attempt <= attempts; attempt += 1) {
        const client = await this.pool.connect();
        const lockedKeys: string[] = [];
        let destroyConnection = false;
        let retry = false;
        try {
          for (const serializationKey of serializationKeys) {
            await client.query('select pg_advisory_lock(hashtextextended($1,0))', [serializationKey]);
            lockedKeys.push(serializationKey);
          }
          await client.query(values.workload === 'command' ? 'begin isolation level serializable' : 'begin');
          await this.context.apply(client, values);
          const result = await operation(client);
          await client.query('commit');
          return result as T;
        } catch (cause) {
          await client.query('rollback');
          if (attempt === attempts || !retryable(cause)) throw cause;
          retry = true;
        } finally {
          for (const serializationKey of lockedKeys.reverse()) {
            if (!destroyConnection) {
              try {
                const released = await client.query<{ released: boolean }>(
                  'select pg_advisory_unlock(hashtextextended($1,0)) released', [serializationKey]);
                destroyConnection = released.rows[0]?.released !== true;
              } catch {
                destroyConnection = true;
              }
            }
          }
          client.release(destroyConnection);
        }
        if (retry) await this.pauseBeforeRetry(attempt);
      }
      throw new Error('TRANSACTION_RETRY_EXHAUSTED');
    } finally {
      releaseProcessLocks();
    }
  }
}

const PROCESS_LOCK_TAILS = new Map<string, Promise<void>>();

async function acquireProcessLocks(keys: readonly string[]): Promise<() => void> {
  const releases: (() => void)[] = [];
  for (const key of keys) {
    let release!: () => void;
    const held = new Promise<void>((resolve) => { release = resolve; });
    const previous = PROCESS_LOCK_TAILS.get(key) ?? Promise.resolve();
    const tail = previous.then(() => held);
    PROCESS_LOCK_TAILS.set(key, tail);
    await previous;
    releases.push(() => {
      release();
      if (PROCESS_LOCK_TAILS.get(key) === tail) PROCESS_LOCK_TAILS.delete(key);
    });
  }
  return () => {
    for (const release of releases.reverse()) release();
  };
}

function retryable(cause: unknown): boolean {
  return cause !== null && typeof cause === 'object' && 'code' in cause && ['40001', '40P01'].includes(String(cause.code));
}

function retryPause(attempt: number): Promise<void> {
  const base = Math.min(250, 5 * (2 ** (attempt - 1)));
  return new Promise((resolve) => setTimeout(resolve, base + Math.floor(Math.random() * base)));
}
