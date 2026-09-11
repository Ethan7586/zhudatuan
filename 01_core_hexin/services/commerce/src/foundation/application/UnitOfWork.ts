import type { QueryResult, QueryResultRow } from 'pg';

export interface Transaction {
  query<R extends QueryResultRow = QueryResultRow>(text: string, values?: readonly unknown[]): Promise<QueryResult<R>>;
}

const managedTxBrand: unique symbol = Symbol('managed-transaction-context');

export interface ManagedTransactionContext<M extends 'read' | 'write'> {
  readonly [managedTxBrand]: M;
  readonly id: string;
  readonly mode: M;
  readonly lineId: string;
  readonly nodeId: string;
  readonly sovereigntyTier: 'sovereign' | 'hosted';
  readonly hostSovereignNodeId: string;
  readonly realmRef: string;
  readonly scope: string;
  readonly membershipId: string;
  readonly actorId: string;
  readonly accessVersion: number;
  readonly lineageDigest: string;
  readonly manifestDigest: string;
  readonly runtimeInstanceId: string;
  readonly operation: string;
  readonly trace: string;
  readonly deadline: number;
  readonly signal: AbortSignal;
}

export type ReadTx = ManagedTransactionContext<'read'> | ManagedTransactionContext<'write'>;
export type WriteTx = ManagedTransactionContext<'write'>;

const activeManagedTransactions = new WeakSet<object>();

export function openWriteTx(values: Omit<WriteTx, typeof managedTxBrand | 'mode'>): WriteTx {
  const context = Object.freeze({ ...values, [managedTxBrand]: 'write', mode: 'write' }) as WriteTx;
  activeManagedTransactions.add(context);
  return context;
}

export function closeWriteTx(context: WriteTx): void {
  activeManagedTransactions.delete(context);
}

export function assertActiveWriteTx(context: WriteTx): void {
  if (!activeManagedTransactions.has(context)) throw new Error('TRANSACTION_CONTEXT_INACTIVE');
}

export interface TransactionContext {
  readonly tenant: string;
  readonly membership: string;
  readonly scope: string;
  readonly actor: string;
  readonly trace: string;
  readonly workload: 'query' | 'command' | 'worker' | 'migration';
  readonly serializationKeys?: readonly string[];
}

export interface UnitOfWork {
  execute<T>(context: TransactionContext, operation: (transaction: Transaction) => Promise<T>): Promise<T>;
}
