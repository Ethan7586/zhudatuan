import { PgTransactionAccess } from '../../../../adapter/database/PgTransactionAccess';
import type { ReadTransactionContext, WriteTransactionContext } from '../../../../foundation/persistence/TransactionContext';
import type { CleanupBatch, ImportCleanup } from '../../application/port/CleanupPort';
import { cleanupBatch, cleanupIds, cleanupLimit } from './PgCleanupValue';

export class PgImportCleanup implements ImportCleanup {
  constructor(private readonly transactions = new PgTransactionAccess()) {}

  async expire(context: WriteTransactionContext, limit: number): Promise<void> {
    cleanupLimit(limit);
    await this.transactions.database(context).query(
      `with candidates as(
         select id from runtime.imports where state in('uploaded','scanning','preflight','ready')
         and retention_until<=clock_timestamp() and not(checkpoint ? 'confirmedAt')
         order by retention_until,id limit $1 for update skip locked
       ) update runtime.imports set state='expired',version=version+1,updated_by='job:cleanup',updated_at=clock_timestamp()
       from candidates where imports.id=candidates.id`,
      [limit]
    );
  }

  async plan(context: ReadTransactionContext, limit: number): Promise<CleanupBatch> {
    cleanupLimit(limit);
    const result = await this.transactions.database(context).query<{ id: string; object_key: string; error_report_key: string | null }>(
      `select id,object_key,error_report_key from runtime.imports
       where state in('rejected','succeeded','failed','cancelled','expired') and retention_until<clock_timestamp()
       order by retention_until,id limit $1`,
      [limit]
    );
    return cleanupBatch(result.rows, 'import:');
  }

  async purge(context: WriteTransactionContext, ids: readonly string[]): Promise<number> {
    const candidates = cleanupIds(ids, 'import:');
    if (candidates.length === 0) return 0;
    const result = await this.transactions.database(context).query(
      `with candidates as materialized(
         select id from runtime.imports where id=any($1::text[])
         and state in('rejected','succeeded','failed','cancelled','expired') and retention_until<clock_timestamp()
       ), chunks as(delete from runtime.import_chunks using candidates where import_chunks.import_id=candidates.id)
       delete from runtime.imports using candidates where imports.id=candidates.id returning imports.id`,
      [candidates]
    );
    return result.rows.length;
  }
}
