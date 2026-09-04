import type { QueryResultRow } from 'pg';
import { PgTransactionAccess } from '../../../../adapter/database/PgTransactionAccess';
import type { ReadTransactionContext } from '../../../../foundation/persistence/TransactionContext';
import type { MemberProfileLabel, MemberSummary, MemberReadPort, PrincipalSummary } from '../../public/MemberReadPort';
interface MemberRow extends QueryResultRow {
  readonly id: string;
  readonly display_name: string;
  readonly employee_no: string | null;
  readonly mobile_masked: string | null;
  readonly status: string;
  readonly version: number;
}
interface PrincipalRow extends QueryResultRow {
  readonly principal: string;
  readonly display_name: string;
  readonly mobile_masked: string | null;
}
interface ProfileLabelRow extends QueryResultRow {
  readonly member: string;
  readonly display_name: string;
  readonly mobile_masked: string | null;
}
export class PgMemberReadPort implements MemberReadPort {
  constructor(private readonly transactions = new PgTransactionAccess()) {}
  async summary(context: ReadTransactionContext, member: string, scope: string): Promise<MemberSummary | null> {
    const database = this.transactions.database(context);
    const result = await database.query<MemberRow>(
      `select id,display_name,employee_no,mobile_masked,status,version
      from member.profile_summary($1,$2)`,
      [member, scope]
    );
    const row = result.rows[0];
    return row ? Object.freeze({ id: row.id, displayName: row.display_name, employeeNo: row.employee_no, mobileMasked: row.mobile_masked, status: row.status, version: Number(row.version) }) : null;
  }

  async principals(context: ReadTransactionContext, principals: readonly string[], scope: string): Promise<readonly PrincipalSummary[]> {
    if (principals.length === 0) return Object.freeze([]);
    const result = await this.transactions.database(context).query<PrincipalRow>(
      `select profile.principal_id principal,summary.display_name,summary.mobile_masked
      from member.profile profile cross join lateral member.profile_summary(profile.id,$2) summary
      where profile.principal_id=any($1::text[]) order by profile.principal_id`,
      [[...new Set(principals)], scope]
    );
    return Object.freeze(result.rows.map((row) => Object.freeze({ principal: row.principal, displayName: row.display_name, mobileMasked: row.mobile_masked })));
  }

  async profiles(context: ReadTransactionContext, members: readonly string[], scope: string): Promise<readonly MemberProfileLabel[]> {
    if (members.length === 0) return Object.freeze([]);
    const result = await this.transactions.database(context).query<ProfileLabelRow>(
      `select requested.member,summary.display_name,summary.mobile_masked
      from unnest($1::text[]) requested(member)
      cross join lateral member.profile_summary(requested.member,$2) summary
      order by requested.member`,
      [[...new Set(members)], scope]
    );
    return Object.freeze(result.rows.map((row) => Object.freeze({ member: row.member, displayName: row.display_name, mobileMasked: row.mobile_masked })));
  }

  async search(context: ReadTransactionContext, query: string, limit = 200): Promise<readonly string[]> {
    const normalized = query.normalize('NFKC').trim();
    if (!normalized || !Number.isSafeInteger(limit) || limit < 1 || limit > 1000) return Object.freeze([]);
    const result = await this.transactions.database(context).query<{ member: string }>(
      `select distinct membership.member_id member from member.membership membership
      join member.profile profile on profile.id=membership.member_id
      left join member.mobile mobile on mobile.member_id=profile.id and mobile.state='active'
      where membership.status='active' and (profile.display_name ilike '%'||$1||'%' or membership.employee_no=$1 or mobile.mobile_masked=$1)
      order by membership.member_id limit $2`,
      [normalized, limit]
    );
    return Object.freeze(result.rows.map(({ member }) => member));
  }
}
