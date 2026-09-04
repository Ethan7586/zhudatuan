import type { QueryResultRow } from 'pg';
import { PgTransactionAccess } from '../../../../adapter/database/PgTransactionAccess';
import type { ReadTransactionContext } from '../../../../foundation/persistence/TransactionContext';
import type { MembershipReadPort } from '../../public/MembershipReadPort';
interface MembershipRow extends QueryResultRow {
  readonly id: string;
  readonly member_id: string;
  readonly employee_no: string | null;
}
export class PgMembershipReadPort implements MembershipReadPort {
  constructor(private readonly transactions = new PgTransactionAccess()) {}
  async member(context: ReadTransactionContext, membership: string): Promise<string | null> {
    const database = this.transactions.database(context);
    const result = await database.query<MembershipRow>(`select member_id from access.membership where id=$1 and client='storefront' and status='active'`, [membership]);
    return result.rows[0]?.member_id ?? null;
  }
  async summaries(context: ReadTransactionContext, memberships: readonly string[], scope: string) {
    if (memberships.length === 0) return Object.freeze([]);
    const result = await this.transactions.database(context).query<MembershipRow>(
      `select id,member_id,employee_no from access.membership
      where id=any($1::text[]) and access.membership_visible_to($2,id) order by id`,
      [[...new Set(memberships)], scope]
    );
    return Object.freeze(result.rows.map((row) => Object.freeze({ membership: row.id, member: row.member_id, employeeNo: row.employee_no })));
  }
}
