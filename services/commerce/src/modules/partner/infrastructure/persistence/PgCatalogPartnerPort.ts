import { PgTransactionAccess } from '../../../../platform/database/PgTransactionAccess';
import type { ReadTransactionContext } from '../../../../platform/database/TransactionContext';
import type { CatalogPartnerPort } from '../../public/CatalogPartnerPort';
export class PgCatalogPartnerPort implements CatalogPartnerPort {
  private readonly transactions = new PgTransactionAccess();
  async scopes(context: ReadTransactionContext, partners: readonly string[]): Promise<ReadonlyMap<string, string>> {
    if (partners.length === 0) return new Map();
    const database = this.transactions.database(context);
    const result = await database.query<{ id: string; scope_id: string }>(`select id,scope_id from partner.partner where id=any($1::text[]) and status='active' order by id`, [partners]);
    return new Map(result.rows.map(({ id, scope_id }) => [id, scope_id]));
  }
}
