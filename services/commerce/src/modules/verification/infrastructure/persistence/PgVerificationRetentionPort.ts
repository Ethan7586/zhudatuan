import { PgTransactionAccess } from '../../../../adapter/database/PgTransactionAccess';
import type { WriteTransactionContext } from '../../../../foundation/persistence/TransactionContext';
import type { VerificationRetentionPort } from '../../public';

export class PgVerificationRetentionPort implements VerificationRetentionPort {
  private readonly transactions = new PgTransactionAccess();

  async purge(context: WriteTransactionContext): Promise<void> {
    const database = this.transactions.database(context);
    await database.query(`update verification.session set state='expired',version=version+1 where state='issued' and expires_at<clock_timestamp()`);
    await database.query(`update verification.proof set state='expired',version=version+1 where state='active' and expires_at<clock_timestamp()`);
    await database.query(`delete from verification.proof where state in('consumed','revoked','expired') and expires_at<clock_timestamp()-interval '90 days'`);
    await database.query(`delete from verification.token where expires_at<clock_timestamp()-interval '1 day'`);
  }
}
