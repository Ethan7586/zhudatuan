import { PgTransactionAccess } from '../../../../adapter/database/PgTransactionAccess';
import type { ReadTransactionContext } from '../../../../foundation/persistence/TransactionContext';
import type { SettlementCursor, SettlementEntry, SettlementReadPort } from '../../public/SettlementReadPort';

export class PgSettlementReadPort implements SettlementReadPort {
  private readonly transactions = new PgTransactionAccess();

  async entries(context: ReadTransactionContext, accountIds: readonly string[], after: SettlementCursor, limit: number): Promise<readonly SettlementEntry[]> {
    if (accountIds.length === 0) return Object.freeze([]);
    const database = this.transactions.database(context);
    const result = await database.query<{
      id: string; accountId: string; amountMinor: number; referenceType: string; referenceId: string; description: string; occurredAt: Date | string;
    }>(
      `select entry.id,entry.account_id "accountId",
      case entry.side when 'credit' then entry.amount_minor else -entry.amount_minor end::float8 "amountMinor",
      journal.reference_type "referenceType",journal.reference_id "referenceId",journal.description,
      journal.posted_at "occurredAt" from finance.entry entry
      join finance.journal journal on journal.id=entry.journal_id and journal.state='posted'
      where entry.account_id=any($1::text[]) and ($2::timestamptz is null or (journal.posted_at,entry.id)<($2::timestamptz,$3))
      order by journal.posted_at desc,entry.id desc limit $4`,
      [accountIds, after.occurredAt, after.entry, limit]
    );
    return Object.freeze(result.rows.map((row) => Object.freeze(row)));
  }
}
