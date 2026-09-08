import { PgTransactionAccess } from '../../../../platform/database/PgTransactionAccess';
import type { ReadTransactionContext, WriteTransactionContext } from '../../../../platform/database/TransactionContext';
import type { CleanupBatch, ExportCleanup } from '../../application/port/CleanupPort';
import { cleanupBatch, cleanupIds, cleanupLimit } from './PgCleanupValue';

export class PgExportCleanup implements ExportCleanup {
  constructor(private readonly transactions = new PgTransactionAccess()) {}

  async plan(context: ReadTransactionContext, limit: number): Promise<CleanupBatch> {
    cleanupLimit(limit);
    const result = await this.transactions.database(context).query<{ id: string; object_key: string | null }>(
      `select id,object_key from runtime.exports where state in('ready','failed','expired','cancelled')
       and retention_until<clock_timestamp() order by retention_until,id limit $1`,
      [limit]
    );
    return cleanupBatch(result.rows, 'export:');
  }

  async purge(context: WriteTransactionContext, ids: readonly string[]): Promise<number> {
    const candidates = cleanupIds(ids, 'export:');
    if (candidates.length === 0) return 0;
    const result = await this.transactions.database(context).query(
      `delete from runtime.exports where state in('ready','failed','expired','cancelled') and retention_until<clock_timestamp()
       and id=any($1::text[]) returning id`,
      [candidates]
    );
    return result.rows.length;
  }
}
