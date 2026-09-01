import { PgTransactionAccess } from '../../../../adapter/database/PgTransactionAccess';
import type { ReadTransactionContext, WriteTransactionContext } from '../../../../foundation/persistence/TransactionContext';
import type { CartExperiencePort } from '../../public/CartExperiencePort';
export class PgCartExperiencePort implements CartExperiencePort {
  private readonly transactions = new PgTransactionAccess();
  async active(context: ReadTransactionContext, scope: string): Promise<string | null> {
    const database = this.transactions.database(context);
    const result = await database.query<{
      id: string;
    }>(
      `select id from experience.application where mall_id=$1 and status='active'
      order by updated_at desc,id limit 1`,
      [scope]
    );
    return result.rows[0]?.id ?? null;
  }
}
