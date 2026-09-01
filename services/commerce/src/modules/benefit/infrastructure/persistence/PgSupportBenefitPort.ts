import { PgTransactionAccess } from '../../../../adapter/database/PgTransactionAccess';
import type { ReadTransactionContext, WriteTransactionContext } from '../../../../foundation/persistence/TransactionContext';
import type { SupportBenefitPort } from '../../public/SupportBenefitPort';
export class PgSupportBenefitPort implements SupportBenefitPort {
  private readonly transactions = new PgTransactionAccess();
  async lot(context: ReadTransactionContext, id: string, member: string, scopes: readonly string[]): Promise<Readonly<Record<string, unknown>> | null> {
    const database = this.transactions.database(context);
    const result = await database.query(
      `select lot.id,lot.batch_id,lot.total_minor,lot.remaining_minor,lot.state,lot.effective_at,
      lot.expires_at,account.kind,account.currency from benefit.lot lot join benefit.account account on account.id=lot.account_id
      where lot.id=$1 and lot.member_id=$2 and account.scope_id=any($3::text[])`,
      [id, member, scopes]
    );
    return result.rows[0] ? Object.freeze(result.rows[0]) : null;
  }
}
