import type { PoolClient, QueryResult, QueryResultRow } from 'pg';
import { PgTransactionManager } from '../adapter/database/PgTransactionManager';
import type { DatabasePool } from '../foundation/persistence/Pool';
import type { ReadTransactionContext, WriteTransactionContext } from '../foundation/persistence/TransactionContext';

type Query = (text: string, values?: readonly unknown[]) => Promise<QueryResult<any>>;

export function withReadTransaction<T>(query: Query, work: (context: ReadTransactionContext) => Promise<T>): Promise<T> {
  return manager(query).read(options('read'), work);
}

export function withWriteTransaction<T>(query: Query, work: (context: WriteTransactionContext) => Promise<T>): Promise<T> {
  return manager(query).write(options('write'), work);
}

function manager(query: Query): PgTransactionManager {
  const control = new Set(['begin read only', 'begin isolation level serializable', 'commit', 'rollback']);
  const client = {
    query: async <R extends QueryResultRow = QueryResultRow>(text: string, values?: readonly unknown[]) => {
      if (control.has(text) || text.startsWith('select set_config(')) return result<R>([]);
      return query(text, values) as Promise<QueryResult<R>>;
    },
    release: () => undefined,
  } as unknown as PoolClient;
  const pool: DatabasePool = {
    connect: async () => client,
    query,
    workload: () => pool,
    end: async () => undefined,
  };
  return new PgTransactionManager(pool);
}

export function transactionManager(query: Query): PgTransactionManager {
  return manager(query);
}

function options(operation: string) {
  const signal = new AbortController().signal;
  return { tenant: 'tenant:test', membership: 'membership:test', scope: 'scope:test', actor: 'actor:test', trace: 'trace:test', operation, deadline: Date.now() + 10_000, signal };
}

export function result<R extends QueryResultRow = QueryResultRow>(rows: readonly R[]): QueryResult<R> {
  return { rows: [...rows], rowCount: rows.length, command: '', oid: 0, fields: [] } as unknown as QueryResult<R>;
}
