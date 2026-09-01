import { PgTransactionAccess } from '../../../../adapter/database/PgTransactionAccess';
import type { ReadTransactionContext, WriteTransactionContext } from '../../../../foundation/persistence/TransactionContext';
import type { ExtensionStateSink } from '../../../extension/public/index';
export class PgExtensionStateSink implements ExtensionStateSink {
  private readonly transactions = new PgTransactionAccess();
  async degrade(context: ReadTransactionContext, id: string, scope: string): Promise<void> {
    const database = this.transactions.database(context);
    await database.query(
      `update channel.connection set status='degraded',version=version+1,updated_at=clock_timestamp()
      where id=$1 and scope_id=$2 and status='enabled'`,
      [id, scope]
    );
  }
}
