import { PgTransactionAccess } from '../../../../adapter/database/PgTransactionAccess';
import type { ReadTransactionContext, WriteTransactionContext } from '../../../../foundation/persistence/TransactionContext';
import type { CatalogPartnerPort } from '../../public/CatalogPartnerPort';
export class PgCatalogPartnerPort implements CatalogPartnerPort {
  private readonly transactions = new PgTransactionAccess();
  async scope(context: ReadTransactionContext, partner: string): Promise<string | null> {
    const database = this.transactions.database(context);
    const result = await database.query<{
      scope_id: string;
    }>(`select scope_id from partner.partner where id=$1 and status='active'`, [partner]);
    return result.rows[0]?.scope_id ?? null;
  }
}
