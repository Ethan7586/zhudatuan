import type { QueryResult, QueryResultRow } from 'pg';
import type { ReadTransactionContext } from '../../platform/database/TransactionContext';
import { pgTransactionState } from './PgTransactionState';

export interface SqlExecutor {
  readonly transaction: ReadTransactionContext;
  query<R extends QueryResultRow = QueryResultRow>(text: string, values?: readonly unknown[]): Promise<QueryResult<R>>;
}

export class PgTransactionAccess {
  database(context: ReadTransactionContext): SqlExecutor {
    this.assertActive(context);
    return Object.freeze({
      transaction: context,
      query: <R extends QueryResultRow = QueryResultRow>(text: string, values?: readonly unknown[]) => {
        const active = this.assertActive(context);
        if (active.mode === 'read' && mutates(text)) throw new Error('READ_TRANSACTION_WRITE_FORBIDDEN');
        return active.client.query<R>(text, values as unknown[] | undefined);
      },
    });
  }

  private assertActive(context: ReadTransactionContext) {
    const active = pgTransactionState.getStore();
    if (!active || !active.open) throw new Error('TRANSACTION_CONTEXT_INACTIVE');
    if (active.context !== context) throw new Error('TRANSACTION_CONTEXT_FORGED');
    if (context.signal.aborted) throw context.signal.reason ?? new Error('TRANSACTION_ABORTED');
    if (context.deadline <= Date.now()) throw new Error('DEADLINE_EXCEEDED');
    return active;
  }
}

function mutates(statement: string): boolean {
  const sql = statement
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .replace(/--[^\n]*/g, ' ')
    .trim()
    .toLowerCase();
  return /\b(insert|update|delete|merge|create|alter|drop|truncate|grant|revoke|comment|vacuum|analyze|refresh|reindex|cluster|call)\b/.test(sql);
}
