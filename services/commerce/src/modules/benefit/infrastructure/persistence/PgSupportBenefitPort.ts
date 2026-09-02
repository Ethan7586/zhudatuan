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
  async recent(context: ReadTransactionContext, member: string, scopes: readonly string[], limit: number): Promise<readonly Readonly<Record<string, unknown>>[]> {
    const result = await this.transactions.database(context).query(
      `select lot.id,lot.remaining_minor,lot.state,lot.expires_at,account.kind,account.currency
      from benefit.lot lot join benefit.account account on account.id=lot.account_id
      where lot.member_id=$1 and account.scope_id=any($2::text[])
      order by lot.created_at desc,lot.id desc limit $3`,
      [member, scopes, Math.min(Math.max(limit, 1), 10)]
    );
    return Object.freeze(result.rows.map((row) => Object.freeze(row)));
  }
}
