import type { QueryResultRow } from 'pg';
import { PgTransactionAccess } from '../../../../adapter/database/PgTransactionAccess';
import type { ReadTransactionContext } from '../../../../foundation/persistence/TransactionContext';
import type { MembershipReadPort } from '../../public/MembershipReadPort';
interface MembershipRow extends QueryResultRow {
  readonly member_id: string;
}
export class PgMembershipReadPort implements MembershipReadPort {
  constructor(private readonly transactions = new PgTransactionAccess()) {}
  async member(context: ReadTransactionContext, membership: string): Promise<string | null> {
    const database = this.transactions.database(context);
    const result = await database.query<MembershipRow>(`select member_id from access.membership where id=$1 and client='storefront' and status='active'`, [membership]);
    return result.rows[0]?.member_id ?? null;
  }
}
