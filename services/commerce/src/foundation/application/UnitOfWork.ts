import type { QueryResult, QueryResultRow } from 'pg';

export interface Transaction {
  query<R extends QueryResultRow = QueryResultRow>(text: string, values?: readonly unknown[]): Promise<QueryResult<R>>;
}

export interface TransactionContext {
  readonly tenant: string;
  readonly membership: string;
  readonly scope: string;
  readonly actor: string;
  readonly trace: string;
  readonly workload: 'query' | 'command' | 'worker' | 'migration';
}

export interface UnitOfWork {
  execute<T>(context: TransactionContext, operation: (transaction: Transaction) => Promise<T>): Promise<T>;
}
