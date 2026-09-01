import type { QueryResultRow } from 'pg';
import { PgTransactionAccess } from '../../../../adapter/database/PgTransactionAccess';
import type { ReadTransactionContext } from '../../../../foundation/persistence/TransactionContext';
import type { BenefitSummary, BenefitReadPort } from '../../public/BenefitReadPort';
interface BenefitRow extends QueryResultRow {
  readonly accounts: number;
  readonly available_minor: number;
  readonly currency: string | null;
  readonly version: number;
}
export class PgBenefitReadPort implements BenefitReadPort {
  constructor(private readonly transactions = new PgTransactionAccess()) {}
  async summary(context: ReadTransactionContext, member: string, mall: string): Promise<BenefitSummary> {
    const database = this.transactions.database(context);
    const result = await database.query<BenefitRow>(
      `select count(*)::integer accounts,coalesce(sum(greatest(0,balance.balance_minor)),0)::bigint available_minor,
        min(account.currency) currency,coalesce(max(account.version),0)::bigint version
        from benefit.account account join benefit.balance balance on balance.account_id=account.id
        where account.member_id=$1 and account.scope_id=$2 and account.status='active'`,
      [member, mall]
    );
    const row = result.rows[0]!;
    return Object.freeze({ accounts: Number(row.accounts), availableMinor: Number(row.available_minor), currency: row.currency, version: Number(row.version) });
  }
}
