import type { ReadTransactionContext } from '../../../../platform/database/TransactionContext';

export interface AuditHistoryRecord extends Record<string, unknown> {
  readonly id: string;
  readonly occurred_at: string;
}

export interface AuditHistoryRepository {
  records(context: ReadTransactionContext, scope: string, cursor: Readonly<{ sort: string | null; id: string | null }>, watermark: string, fetch: number): Promise<readonly AuditHistoryRecord[]>;
}
