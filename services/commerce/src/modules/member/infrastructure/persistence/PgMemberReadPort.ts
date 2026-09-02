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
  async summary(context: ReadTransactionContext, member: string, scope: string): Promise<MemberSummary | null> {
    const database = this.transactions.database(context);
    const result = await database.query<MemberRow>(
      `select profile.id,profile.display_name,membership.employee_no,profile.mobile_masked,profile.status,profile.version
      from member.profile profile
      left join lateral (
        select candidate.employee_no from access.membership candidate
        where candidate.member_id=profile.id and candidate.status='active'
          and exists(select 1 from organization.unitclosure related
            where (related.ancestor_id=$2 and related.descendant_id=candidate.organization_id)
              or (related.ancestor_id=candidate.organization_id and related.descendant_id=$2))
        order by (candidate.organization_id=$2) desc,candidate.id limit 1
      ) membership on true
      where profile.id=$1 and profile.status='active'`,
      [member, scope]
    );
    const row = result.rows[0];
    return row ? Object.freeze({ id: row.id, displayName: row.display_name, employeeNo: row.employee_no, mobileMasked: row.mobile_masked, status: row.status, version: Number(row.version) }) : null;
  }
}
