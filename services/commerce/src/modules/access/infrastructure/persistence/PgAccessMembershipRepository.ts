import { PgTransactionAccess } from '../../../../adapter/database/PgTransactionAccess';
import type { ReadTransactionContext, WriteTransactionContext } from '../../../../foundation/persistence/TransactionContext';
import type { ActiveMembershipReference, DirectoryMembershipReference, MemberRecord } from '../../application/port/AccessRepository';
import type { MemberProfileProjection } from '../../public/MemberAccessPort';
import { isOperationTarget, type OperationTarget } from '@shop/contract';
import { DomainError } from '../../../../foundation/domain/DomainError';
interface MemberRow {
  readonly id: string;
  readonly member_id: string;
  readonly organization_id: string;
  readonly employee_no: string | null;
  readonly status: string;
  readonly access_version: number;
  readonly joined_at: Date | null;
  readonly registration_reset_allowed: boolean;
  readonly registration_reset_block_reason: 'self' | 'protected' | 'inactive' | null;
}
interface IdentityMembershipRow {
  readonly id: string;
  readonly principal_id: string;
  readonly client: string;
  readonly organization_id: string;
  readonly access_version: number;
  readonly display_name: string;
  readonly organization_name: string;
  readonly scope_kind: string;
  readonly role_label: string | null;
}
export class PgAccessMembershipRepository {
  protected readonly transactions = new PgTransactionAccess();
  async activeMemberships(context: ReadTransactionContext, member: string, target: 'console' | 'storefront' | 'miniapp' | 'store' | 'supplier'): Promise<readonly ActiveMembershipReference[]> {
    const database = this.transactions.database(context);
    const result = await database.query<IdentityMembershipRow>(
      `select id,principal_id,client,organization_id,access_version,display_name,organization_name,scope_kind,role_label
      from access.identity_memberships($1,$2,null) order by organization_name,id`,
      [member, target]
    );
    return Object.freeze(result.rows.map((row) => identityMembership(row, target)));
  }
  async lockSession(context: WriteTransactionContext, membership: string, target: 'console' | 'storefront' | 'miniapp' | 'store' | 'supplier'): Promise<number | null> {
    const database = this.transactions.database(context);
    const result = await database.query<{
      access_version: number;
    }>(
      `select access_version from access.membership where id=$1
      and status='active' and (($2 in ('storefront','miniapp') and client='storefront') or ($2='console' and client='operator') or client=$2) for update`,
      [membership, target]
    );
    return result.rows[0] === undefined ? null : Number(result.rows[0].access_version);
  }
  async directoryMemberships(context: ReadTransactionContext, memberships: readonly string[]): Promise<readonly DirectoryMembershipReference[]> {
    const database = this.transactions.database(context);
    const result = await database.query<IdentityMembershipRow>(
      `select id,principal_id,client,organization_id,access_version,display_name,organization_name,scope_kind,role_label
      from access.identity_memberships(null,null,$1::text[]) order by id`,
      [memberships]
    );
    return Object.freeze(result.rows.map((row) => Object.freeze({ ...identityMembership(row), principal: row.principal_id })));
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
  async memberPage(context: ReadTransactionContext, organization: string, actorMembership: string, after: string | null, limit: number): Promise<readonly MemberRecord[]> {
    const database = this.transactions.database(context);
    const result = await database.query<MemberRow>(
      `select membership.id,membership.member_id,membership.organization_id,membership.employee_no,membership.status,
      membership.access_version,membership.joined_at,
      block.reason is null registration_reset_allowed,block.reason registration_reset_block_reason
      from access.membership membership
      left join lateral (
        select case
          when membership.id=$2 then 'self'
          when membership.status not in('active','suspended') then 'inactive'
          when exists(select 1 from access.membershiprole assignment join access.role role on role.id=assignment.role_id
            where assignment.membership_id=membership.id and role.kind='owner' and role.status='active'
              and assignment.effective_at<=clock_timestamp()
              and (assignment.expires_at is null or assignment.expires_at>clock_timestamp())) then 'protected'
          else null end reason
      ) block on true
      where membership.organization_id=$1 and ($3::text is null or membership.id>$3)
      order by membership.id limit $4`,
      [organization, actorMembership, after, limit]
    );
    return Object.freeze(result.rows.map(memberRecord));
  }
  async memberProfile(context: ReadTransactionContext, membership: string): Promise<MemberRecord | null> {
    const database = this.transactions.database(context);
    const result = await database.query<MemberRow>(
      `select id,member_id,organization_id,employee_no,status,access_version,joined_at,
      false registration_reset_allowed,'protected'::text registration_reset_block_reason
      from access.membership where id=$1 and status='active'`,
      [membership]
    );
    return result.rows[0] ? memberRecord(result.rows[0]) : null;
  }
  async upsertMemberProfile(context: WriteTransactionContext, profile: MemberProfileProjection): Promise<void> {
    const database = this.transactions.database(context);
    await database.query(
      `insert into access.memberprofile(member_id,display_name,mobile_masked,source_version,updated_at)
      values($1,$2,$3,$4,clock_timestamp()) on conflict(member_id) do update set
      display_name=excluded.display_name,mobile_masked=excluded.mobile_masked,
      source_version=excluded.source_version,updated_at=excluded.updated_at
      where access.memberprofile.source_version<=excluded.source_version`,
      [profile.member, profile.displayName, profile.mobileMasked, profile.sourceVersion]
    );
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
  async resetMemberRegistrations(context: WriteTransactionContext, member: string, actorMembership: string): Promise<readonly import('../../application/port/AccessRepository').VersionChange[] | null> {
    const database = this.transactions.database(context);
    const authorization = await database.query<Readonly<{ actor_owner: boolean; target_protected: boolean }>>(
      `select
      exists(select 1 from access.membershiprole assignment join access.role role on role.id=assignment.role_id
        join access.membership actor on actor.id=assignment.membership_id
        where actor.id=$2 and actor.status='active' and role.kind='owner' and role.status='active'
          and assignment.effective_at<=clock_timestamp() and (assignment.expires_at is null or assignment.expires_at>clock_timestamp())
          and access.scope_allowed(actor.organization_id)) actor_owner,
      exists(select 1 from access.membership target left join access.membershiprole assignment on assignment.membership_id=target.id
        left join access.role role on role.id=assignment.role_id and role.status='active'
        where target.member_id=$1 and (target.id=$2 or (role.kind='owner' and assignment.effective_at<=clock_timestamp()
          and (assignment.expires_at is null or assignment.expires_at>clock_timestamp())))) target_protected`,
      [member, actorMembership]
    );
    const gate = authorization.rows[0];
    if (!gate?.actor_owner) return null;
    if (gate.target_protected) throw new DomainError('OWNER_MEMBERSHIP_PROTECTED');
    const changed = await database.query<Readonly<{ membership_id: string; organization_id: string; access_version: number }>>(
      `update access.membership membership set status='left',left_at=clock_timestamp(),access_version=access_version+1
      where membership.member_id=$1 and membership.status<>'left' and access.scope_allowed(membership.organization_id)
      returning membership.id membership_id,membership.organization_id,membership.access_version`,
      [member]
    );
    return Object.freeze(changed.rows.map((row) => Object.freeze({ membership: row.membership_id, organization: row.organization_id, version: Number(row.access_version) })));
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

function identityMembership(row: IdentityMembershipRow, requested?: OperationTarget): ActiveMembershipReference {
  return Object.freeze({
    id: row.id,
    client: requested ?? membershipTarget(row.client),
    organization: row.organization_id,
    accessVersion: Number(row.access_version),
    displayName: row.display_name,
    organizationName: row.organization_name,
    scopeKind: row.scope_kind,
    scopeId: row.organization_id,
    roleLabel: row.role_label ?? '已授权成员',
    logoUrl: null,
  });
}
function membershipTarget(value: string): OperationTarget {
  const target = value === 'operator' ? 'console' : value;
  if (!isOperationTarget(target) || target === 'miniapp') throw new Error('MEMBERSHIP_CLIENT_INVALID');
  return target;
}
function memberRecord(row: MemberRow): MemberRecord {
  return Object.freeze({
    id: row.id,
    member: row.member_id,
    organization: row.organization_id,
    employee: row.employee_no,
    status: row.status,
    accessVersion: Number(row.access_version),
    joinedAt: row.joined_at,
    registrationResetAllowed: row.registration_reset_allowed,
    registrationResetBlockReason: row.registration_reset_block_reason,
  });
}
