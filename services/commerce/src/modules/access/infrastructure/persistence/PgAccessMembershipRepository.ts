import { PgTransactionAccess } from '../../../../adapter/database/PgTransactionAccess';
import type { ReadTransactionContext, WriteTransactionContext } from '../../../../foundation/persistence/TransactionContext';
import type { ActiveMembershipReference, DirectoryMembershipReference, MemberRecord } from '../../application/port/AccessRepository';
interface MemberRow {
  readonly id: string;
  readonly member_id: string;
  readonly organization_id: string;
  readonly employee_no: string | null;
  readonly status: string;
  readonly access_version: number;
  readonly joined_at: Date | null;
}
export class PgAccessMembershipRepository {
  protected readonly transactions = new PgTransactionAccess();
  async activeMemberships(context: ReadTransactionContext, member: string, target: 'console' | 'storefront'): Promise<readonly ActiveMembershipReference[]> {
    const database = this.transactions.database(context);
    const result = await database.query<{
      id: string;
      client: string;
      organization_id: string;
      access_version: number;
    }>(
      `select id,client,organization_id,access_version from access.membership where member_id=$1
      and status='active' and (case when client='storefront' then 'storefront' else 'console' end)=$2 order by id`,
      [member, target]
    );
    return Object.freeze(result.rows.map((row) => Object.freeze({ id: row.id, client: row.client === 'storefront' ? 'storefront' : 'console', organization: row.organization_id, accessVersion: Number(row.access_version) })));
  }
  async lockSession(context: WriteTransactionContext, membership: string, target: 'console' | 'storefront'): Promise<number | null> {
    const database = this.transactions.database(context);
    const result = await database.query<{
      access_version: number;
    }>(
      `select access_version from access.membership where id=$1
      and status='active' and (case when client='storefront' then 'storefront' else 'console' end)=$2 for update`,
      [membership, target]
    );
    return result.rows[0] === undefined ? null : Number(result.rows[0].access_version);
  }
  async directoryMemberships(context: ReadTransactionContext, memberships: readonly string[]): Promise<readonly DirectoryMembershipReference[]> {
    const database = this.transactions.database(context);
    const result = await database.query<{
      id: string;
      principal_id: string;
      client: string;
    }>(
      `select id,principal_id,client
      from access.membership where id=any($1::text[]) and status='active' order by id`,
      [memberships]
    );
    return Object.freeze(result.rows.map((row) => Object.freeze({ id: row.id, principal: row.principal_id, client: row.client === 'storefront' ? 'storefront' : 'console' })));
  }
  async ensureImported(
    context: WriteTransactionContext,
    input: Readonly<{
      membership: string;
      member: string;
      principal: string;
      organization: string;
      client: 'operator' | 'storefront';
      employee: string | null;
    }>
  ): Promise<void> {
    const database = this.transactions.database(context);
    await database.query(
      `insert into access.membership(id,member_id,principal_id,organization_id,client,employee_no,status,
      access_version) values($1,$2,$3,$4,$5,$6,'invited',1) on conflict(member_id,organization_id,client) do update
      set principal_id=excluded.principal_id,employee_no=excluded.employee_no`,
      [input.membership, input.member, input.principal, input.organization, input.client, input.employee]
    );
  }
  async activeMember(context: ReadTransactionContext, membership: string): Promise<string | null> {
    const database = this.transactions.database(context);
    const result = await database.query<{
      member_id: string;
    }>(`select member_id from access.membership where id=$1 and status='active'`, [membership]);
    return result.rows[0]?.member_id ?? null;
  }
  async activeMemberIn(context: ReadTransactionContext, member: string, organizations: readonly string[]): Promise<boolean> {
    const database = this.transactions.database(context);
    if (organizations.length === 0) return false;
    const result = await database.query<{
      eligible: boolean;
    }>(
      `select exists(select 1 from access.membership where member_id=$1
      and organization_id=any($2::text[]) and status='active') eligible`,
      [member, organizations]
    );
    return result.rows[0]?.eligible === true;
  }
  async memberPage(context: ReadTransactionContext, organization: string, after: string | null, limit: number): Promise<readonly MemberRecord[]> {
    const database = this.transactions.database(context);
    const result = await database.query<MemberRow>(
      `select id,member_id,organization_id,employee_no,status,access_version,joined_at
      from access.membership where organization_id=$1 and ($2::text is null or id>$2) order by id limit $3`,
      [organization, after, limit]
    );
    return Object.freeze(result.rows.map(memberRecord));
  }
  async memberProfile(context: ReadTransactionContext, membership: string): Promise<MemberRecord | null> {
    const database = this.transactions.database(context);
    const result = await database.query<MemberRow>(
      `select id,member_id,organization_id,employee_no,status,access_version,joined_at
      from access.membership where id=$1 and status='active'`,
      [membership]
    );
    return result.rows[0] ? memberRecord(result.rows[0]) : null;
  }
  async setEmployeeNumber(context: WriteTransactionContext, membership: string, employee: string | null): Promise<boolean> {
    const database = this.transactions.database(context);
    const result = await database.query(`update access.membership set employee_no=$2 where id=$1 returning id`, [membership, employee]);
    return result.rows.length === 1;
  }
  async managementMember(
    context: WriteTransactionContext,
    membership: string
  ): Promise<Readonly<{
    member: string;
    accessVersion: number;
  }> | null> {
    const database = this.transactions.database(context);
    const result = await database.query<{
      member_id: string;
      access_version: number;
    }>(
      `select member_id,access_version from access.membership where id=$1
      and access.scope_allowed(organization_id) for update`,
      [membership]
    );
    const row = result.rows[0];
    return row ? Object.freeze({ member: row.member_id, accessVersion: Number(row.access_version) }) : null;
  }
  async setMembershipStatus(context: WriteTransactionContext, membership: string, status: 'active' | 'suspended' | 'left'): Promise<boolean> {
    const database = this.transactions.database(context);
    const result = await database.query(
      `update access.membership set status=$2,
      left_at=case when $2='left' then clock_timestamp() else null end where id=$1 returning id`,
      [membership, status]
    );
    return result.rows.length === 1;
  }
  async replaceDepartment(
    context: WriteTransactionContext,
    input: Readonly<{
      membership: string;
      department: string;
      path: string;
      grant: string;
    }>
  ): Promise<void> {
    const database = this.transactions.database(context);
    await database.query(`delete from access.scopegrant where membership_id=$1 and scope_kind='department'`, [input.membership]);
    await database.query(
      `insert into access.scopegrant(id,membership_id,scope_kind,scope_id,scope_path,effect,effective_at,
      access_version) values($1,$2,'department',$3,$4,'allow',clock_timestamp(),
      (select access_version from access.membership where id=$2))`,
      [input.grant, input.membership, input.department, input.path]
    );
  }
  async applyDirectoryState(
    context: WriteTransactionContext,
    input: Readonly<{
      membership: string;
      status: 'active' | 'suspended' | 'left';
    }>
  ): Promise<number | null> {
    const database = this.transactions.database(context);
    const changed = await database.query<{
      access_version: number;
    }>(
      `update access.membership set status=$2,
      joined_at=case when $2='active' then coalesce(joined_at,clock_timestamp()) else joined_at end,
      left_at=case when $2='left' then clock_timestamp() when $2='active' then null else left_at end
      where id=$1 returning access_version`,
      [input.membership, input.status]
    );
    const current =
      changed.rows[0] ??
      (
        await database.query<{
          access_version: number;
        }>('select access_version from access.membership where id=$1 for update', [input.membership])
      ).rows[0];
    return current ? Number(current.access_version) : null;
  }
  async replaceDirectoryDepartment(
    context: WriteTransactionContext,
    input: Readonly<{
      membership: string;
      department: string;
      grant: string;
      accessVersion: number;
    }>
  ): Promise<void> {
    const database = this.transactions.database(context);
    await database.query(`delete from access.scopegrant where membership_id=$1 and scope_kind='department'`, [input.membership]);
    await database.query(
      `insert into access.scopegrant(id,membership_id,scope_kind,scope_id,scope_path,effect,effective_at,
      access_version) values($1,$2,'department',$3,$3,'allow',clock_timestamp(),$4)`,
      [input.grant, input.membership, input.department, input.accessVersion]
    );
  }
}
function memberRecord(row: MemberRow): MemberRecord {
  return Object.freeze({ id: row.id, member: row.member_id, organization: row.organization_id, employee: row.employee_no, status: row.status, accessVersion: Number(row.access_version), joinedAt: row.joined_at });
}
