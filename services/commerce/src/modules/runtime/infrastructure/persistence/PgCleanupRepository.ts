import { PgTransactionAccess } from '../../../../adapter/database/PgTransactionAccess';
import type { WriteTransactionContext } from '../../../../foundation/persistence/TransactionContext';
import type { CleanupRepository } from '../../application/port/CleanupRepository';

export class PgCleanupRepository implements CleanupRepository {
  private readonly transactions = new PgTransactionAccess();

  async prepare(context: WriteTransactionContext, currentJobId: string): Promise<void> {
    const transaction = this.transactions.database(context);
    await transaction.query(
      `update runtime.job set state='queued',lease_owner=null,lease_deadline=null,updated_at=clock_timestamp()
      where state='running' and lease_deadline<clock_timestamp() and id<>$1`,
      [currentJobId]
    );
    await transaction.query(`delete from runtime.idempotency where expires_at<clock_timestamp() and state<>'started'`);
  }

  async complete(context: WriteTransactionContext): Promise<void> {
    const transaction = this.transactions.database(context);
    await transaction.query(`delete from runtime.job where state in('completed','cancelled') and updated_at<clock_timestamp()-interval '30 days'`);
    await transaction.query(`delete from runtime.inbox where processed_at<clock_timestamp()-interval '90 days'`);
    await transaction.query(`delete from runtime.outbox where published_at<clock_timestamp()-interval '90 days'`);
  }
}
