import { randomUUID } from 'node:crypto';
import type { PoolClient } from 'pg';
import type { DatabasePool } from '../../platform/database/Pool';
import type { ReadTransactionContext, TransactionMode, WriteTransactionContext } from '../../platform/database/TransactionContext';
import type { TransactionManager, TransactionOptions } from '../../platform/database/TransactionManager';
import { pgTransactionState } from './PgTransactionState';

type Sleep = (milliseconds: number, signal: AbortSignal) => Promise<void>;

export class PgTransactionManager implements TransactionManager {
  constructor(
    private readonly pool: DatabasePool,
    private readonly sleep: Sleep = abortableDelay,
    private readonly random: () => number = Math.random
  ) {}

  read<T>(options: TransactionOptions, work: (context: ReadTransactionContext) => Promise<T>): Promise<T> {
    return this.execute('read', options, work);
  }

  write<T>(options: TransactionOptions, work: (context: WriteTransactionContext) => Promise<T>): Promise<T> {
    return this.execute('write', options, work);
  }

  private async execute<T>(mode: 'read', options: TransactionOptions, work: (context: ReadTransactionContext) => Promise<T>): Promise<T>;
  private async execute<T>(mode: 'write', options: TransactionOptions, work: (context: WriteTransactionContext) => Promise<T>): Promise<T>;
  private async execute<T>(mode: TransactionMode, options: TransactionOptions, work: ((context: ReadTransactionContext) => Promise<T>) | ((context: WriteTransactionContext) => Promise<T>)): Promise<T> {
    assertAvailable(options);
    const joined = pgTransactionState.getStore();
    if (joined) {
      assertJoin(joined.context, mode, options);
      return (work as (context: ReadTransactionContext) => Promise<T>)(joined.context);
    }

    const attempts = mode === 'write' ? (options.workload === 'jobs' ? 8 : 4) : 1;
    for (let attempt = 1; attempt <= attempts; attempt += 1) {
      assertAvailable(options);
      const workload = options.workload === 'jobs' ? 'worker' : mode === 'write' ? 'command' : 'query';
      const client = await this.pool.workload(workload).connect();
      let began = false;
      const context = Object.freeze({
        mode,
        id: randomUUID(),
        tenant: options.tenant,
        membership: options.membership,
        scope: options.scope,
        actor: options.actor,
        trace: options.trace,
        operation: options.operation,
        deadline: options.deadline,
        signal: options.signal,
      }) as unknown as ReadTransactionContext;
      const active = { client, context, mode, open: true };
      try {
        assertAvailable(options);
        await client.query(mode === 'write' ? 'begin isolation level serializable' : 'begin read only');
        began = true;
        assertAvailable(options);
        await applyContext(client, options);
        const result = await pgTransactionState.run(active, () => (work as (context: ReadTransactionContext) => Promise<T>)(context));
        active.open = false;
        await client.query('commit');
        return result;
      } catch (cause) {
        active.open = false;
        if (began) await rollback(client);
        if (attempt === attempts || !retryable(cause)) throw cause;
        assertAvailable(options);
        await this.sleep(retryDelay(attempt, this.random), options.signal);
      } finally {
        active.open = false;
        client.release();
      }
    }
    throw new Error('TRANSACTION_RETRY_EXHAUSTED');
  }
}

function applyContext(client: PoolClient, options: TransactionOptions): Promise<unknown> {
  const statementTimeout = String(Math.max(1, Math.ceil(options.deadline - Date.now())));
  return client.query(
    `select set_config('app.tenant_id',$1,true),set_config('app.membership_id',$2,true),set_config('app.scope_id',$3,true),
    set_config('app.actor_id',$4,true),set_config('app.trace_id',$5,true),set_config('app.operation_id',$6,true),set_config('app.workload',$7,true),
    set_config('app.authorization_snapshot',$8,true),set_config('statement_timeout',$9,true)`,
    [
      options.tenant,
      options.membership,
      options.scope,
      options.actor,
      options.trace,
      options.operation,
      options.workload === 'jobs' ? 'jobs' : 'api',
      options.authorization === undefined ? '' : JSON.stringify(options.authorization),
      statementTimeout,
    ]
  );
}

async function rollback(client: { query(text: string): Promise<unknown> }): Promise<void> {
  try {
    await client.query('rollback');
  } catch {
    // The original transaction failure is authoritative.
  }
}

function assertJoin(active: ReadTransactionContext, requested: TransactionMode, options: TransactionOptions): void {
  if (active.mode === 'read' && requested === 'write') throw new Error('TRANSACTION_MODE_PROMOTION_FORBIDDEN');
  if (active.tenant !== options.tenant || active.membership !== options.membership || active.scope !== options.scope || active.actor !== options.actor || active.trace !== options.trace || active.operation !== options.operation) {
    throw new Error('TRANSACTION_CONTEXT_MISMATCH');
  }
}

function assertAvailable(options: TransactionOptions): void {
  if (options.signal.aborted) throw options.signal.reason ?? new Error('TRANSACTION_ABORTED');
  if (!Number.isFinite(options.deadline) || options.deadline <= Date.now()) throw new Error('DEADLINE_EXCEEDED');
}

function retryable(cause: unknown): boolean {
  return cause !== null && typeof cause === 'object' && 'code' in cause && ['40001', '40P01'].includes(String(cause.code));
}

function retryDelay(attempt: number, random: () => number): number {
  const base = Math.min(100, 7 * 2 ** (attempt - 1));
  return base + Math.floor(random() * base);
}

function abortableDelay(milliseconds: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal.aborted) return reject(signal.reason ?? new Error('TRANSACTION_ABORTED'));
    const timer = setTimeout(done, milliseconds);
    signal.addEventListener('abort', aborted, { once: true });
    function done() {
      signal.removeEventListener('abort', aborted);
      resolve();
    }
    function aborted() {
      clearTimeout(timer);
      reject(signal.reason ?? new Error('TRANSACTION_ABORTED'));
    }
  });
}
