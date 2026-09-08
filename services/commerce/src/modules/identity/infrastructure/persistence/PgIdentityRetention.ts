import { PgTransactionAccess } from '../../../../platform/database/PgTransactionAccess';
import type { WriteTransactionContext } from '../../../../platform/database/TransactionContext';
import type { IdentityRetentionPort } from '../../public/IdentityRetentionPort';
export class PgIdentityRetention implements IdentityRetentionPort {
  private readonly transactions = new PgTransactionAccess();
  async purge(context: WriteTransactionContext): Promise<void> {
    const database = this.transactions.database(context);
    await database.query(`delete from identity.challenge where expires_at<clock_timestamp()-interval '7 days'`);
    await database.query(`delete from identity.session where expires_at<clock_timestamp()-interval '30 days'`);
  }
}
