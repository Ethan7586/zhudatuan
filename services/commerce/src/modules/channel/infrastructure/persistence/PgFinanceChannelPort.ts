import { PgTransactionAccess } from '../../../../adapter/database/PgTransactionAccess';
import type { ReadTransactionContext, WriteTransactionContext } from '../../../../foundation/persistence/TransactionContext';
import type { FinanceStatement, FinanceChannelPort } from '../../public/FinanceChannelPort';
export class PgFinanceChannelPort implements FinanceChannelPort {
  private readonly transactions = new PgTransactionAccess();
  async statement(context: ReadTransactionContext, id: string, scope: string): Promise<FinanceStatement | null> {
    const database = this.transactions.database(context);
    const result = await database.query<{
      id: string;
      scope: string;
      objectRef: string;
      sha256: string;
      periodStart: string;
      periodEnd: string;
    }>(
      `select id,scope_id scope,object_ref "objectRef",sha256,period_start::text "periodStart",period_end::text "periodEnd"
      from channel.statement where id=$1 and scope_id=$2`,
      [id, scope]
    );
    const row = result.rows[0];
    return row ? Object.freeze(row) : null;
  }
}
