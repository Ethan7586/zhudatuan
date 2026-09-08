import type { ReadTransactionContext, WriteTransactionContext } from './TransactionContext';

export type TransactionIsolation = 'read committed' | 'serializable';

export interface TransactionOptions {
  readonly tenant: string;
  readonly membership: string;
  readonly scope: string;
  readonly actor: string;
  readonly trace: string;
  readonly operation: string;
  readonly deadline: number;
  readonly signal: AbortSignal;
  readonly workload?: 'api' | 'jobs';
  readonly isolation?: TransactionIsolation;
  /** Immutable server-issued authorization evidence inherited by deferred work. */
  readonly authorization?: Readonly<Record<string, unknown>>;
}

export interface TransactionManager {
  read<T>(options: TransactionOptions, work: (context: ReadTransactionContext) => Promise<T>): Promise<T>;
  write<T>(options: TransactionOptions, work: (context: WriteTransactionContext) => Promise<T>): Promise<T>;
}
