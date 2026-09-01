import { PgTransactionAccess } from '../../../../adapter/database/PgTransactionAccess';
import type { ReadTransactionContext } from '../../../../foundation/persistence/TransactionContext';
import type { IdentityReadinessPort } from '../../public/ReadinessPort';
export class PgIdentityReadiness implements IdentityReadinessPort {
  constructor(private readonly transactions = new PgTransactionAccess()) {}
  async invitationKeysReady(context: ReadTransactionContext, versions: readonly string[]): Promise<boolean> {
    const database = this.transactions.database(context);
    const result = await this.transactions.database(context).query<{
      ready: boolean;
    }>('select missing_count=0 ready from identity.invitation_key_readiness($1::text[])', [versions]);
    return result.rows[0]?.ready ?? false;
  }
}
