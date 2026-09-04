import { PgTransactionAccess } from '../../../../adapter/database/PgTransactionAccess';
import type { ReadTransactionContext, WriteTransactionContext } from '../../../../foundation/persistence/TransactionContext';
import type { OutboxCleanup } from '../../application/port/CleanupPort';
import { cleanupIds, cleanupLimit } from './PgCleanupValue';
import { retentionBoundary } from './PgMessageRetention';

export class PgOutboxCleanup implements OutboxCleanup {
  constructor(private readonly transactions = new PgTransactionAccess()) {}
  async plan(context: ReadTransactionContext, before: Date, limit: number): Promise<readonly string[]> {
    cleanupLimit(limit);
    const result = await this.transactions.database(context).query<{ id: string }>(
      `select id from runtime.outbox where published_at is not null and published_at<$1 order by published_at,id limit $2`,
      [retentionBoundary(before), limit]
    );
    return cleanupIds(result.rows.map(({ id }) => id));
  }

  async purge(context: WriteTransactionContext, ids: readonly string[], before: Date): Promise<number> {
    const planned = cleanupIds(ids);
    if (planned.length === 0) return 0;
    const result = await this.transactions.database(context).query(
      `delete from runtime.outbox where id=any($1::text[]) and published_at is not null and published_at<$2 returning id`,
      [planned, retentionBoundary(before)]
    );
    return result.rows.length;
  }
}
