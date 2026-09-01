import { PgTransactionAccess } from '../../../../adapter/database/PgTransactionAccess';
import type { WriteTransactionContext } from '../../../../foundation/persistence/TransactionContext';
import type { FederationCleanupRepository } from '../../application/port/CleanupRepository';

export class PgFederationCleanupRepository implements FederationCleanupRepository {
  private readonly transactions = new PgTransactionAccess();

  async expire(context: WriteTransactionContext): Promise<void> {
    const database = this.transactions.database(context);
    await database.query(
      `update identity.federationtransaction set status='expired',
      verifier_ciphertext='[RETIRED]',return_target_ref='[RETIRED]',version=version+1,updated_at=clock_timestamp()
      where expires_at<=clock_timestamp() and status in('created','redirected','callbackreceived','verified','selectionrequired') and consumed_at is null`
    );
    await database.query(`delete from identity.preauth where coalesce(consumed_at,expires_at)<clock_timestamp()-interval '1 day'`);
  }
}
