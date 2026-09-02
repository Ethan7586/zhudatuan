import type { QueryResultRow } from 'pg';
import { PgTransactionAccess } from '../../../../adapter/database/PgTransactionAccess';
import type { ReadTransactionContext } from '../../../../foundation/persistence/TransactionContext';
import type { MemberSummary, MemberReadPort } from '../../public/MemberReadPort';
interface MemberRow extends QueryResultRow {
  readonly id: string;
  readonly display_name: string;
  readonly employee_no: string | null;
  readonly mobile_masked: string | null;
  readonly status: string;
  readonly version: number;
}
export class PgMemberReadPort implements MemberReadPort {
  constructor(private readonly transactions = new PgTransactionAccess()) {}
  async summary(context: ReadTransactionContext, member: string): Promise<MemberSummary | null> {
    const database = this.transactions.database(context);
    const result = await database.query<MemberRow>(`select id,display_name,employee_no,mobile_masked,status,version from member.profile where id=$1 and status='active'`, [member]);
    const row = result.rows[0];
    return row ? Object.freeze({ id: row.id, displayName: row.display_name, employeeNo: row.employee_no, mobileMasked: row.mobile_masked, status: row.status, version: Number(row.version) }) : null;
  }
}
