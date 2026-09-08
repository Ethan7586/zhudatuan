import { AsyncLocalStorage } from 'node:async_hooks';
import type { PoolClient } from 'pg';
import type { ReadTransactionContext, TransactionMode } from '../../platform/database/TransactionContext';

export interface PgTransactionState {
  readonly client: PoolClient;
  readonly context: ReadTransactionContext;
  readonly mode: TransactionMode;
  open: boolean;
}

export const pgTransactionState = new AsyncLocalStorage<PgTransactionState>();
