import { PgTransactionAccess } from '../../../../adapter/database/PgTransactionAccess';
import type { ReadTransactionContext, WriteTransactionContext } from '../../../../foundation/persistence/TransactionContext';
import type {
  AccessCenterRecord,
  AccessRepository,
  DelegationIssuer,
  DelegationPermission,
  DelegationRole,
  DelegationScope,
  DelegationTarget,
  OverrideChange,
  OverrideTarget,
  Ownership,
  RoleChange,
  RoleDirectoryRecord,
  VersionChange,
} from '../../application/port/AccessRepository';
import type { Membership } from '../../domain/model/Membership';
import type { Override } from '../../domain/model/Override';
import { Role, type PermissionEffect } from '../../domain/model/Role';
import type { Scope } from '../../domain/model/Scope';
import { PgAccessGovernanceRepository } from './PgAccessGovernanceRepository';
import { membershipModel, overrideChange, roleModel, scopeModel, type CenterRow, type MembershipRow, type OverrideRow, type OverrideTargetRow, type RoleRow, type ScopeRow } from './AccessRecord';
import { isOperationTarget, type OperationTarget } from '@shop/contract';
export class PgAccessRepository extends PgAccessGovernanceRepository implements AccessRepository {
  async center(
    context: ReadTransactionContext,
    input: Readonly<{
      organization: string;
      after: string | null;
      limit: number;
    }>
  ): Promise<readonly AccessCenterRecord[]> {
    const database = this.transactions.database(context);
    const result = await database.query<CenterRow>(
      `select membership.id,profile.display_name,membership.employee_no,profile.mobile_masked,
      membership.client,
      membership.status,membership.access_version,
      coalesce(roleitems.items,'[]'::jsonb) roles,
      coalesce(scopeitems.items,'[]'::jsonb) scopes,
      coalesce(overrideitems.items,'[]'::jsonb) overrides
      from access.membership membership
      left join access.memberprofile profile on profile.member_id=membership.member_id
      left join lateral (
        select jsonb_agg(jsonb_build_object('role',assigned.id,'name',assigned.name,'description',assigned.description,
          'status',assigned.status,'kind',assigned.kind,'template',assigned.template_code,'version',assigned.version,
          'allows',coalesce((select jsonb_agg(permission.code order by permission.code) from access.rolepermission mapping
            join access.permission permission on permission.id=mapping.permission_id where mapping.role_id=assigned.id and mapping.effect='allow'),'[]'::jsonb),
          'denies',coalesce((select jsonb_agg(permission.code order by permission.code) from access.rolepermission mapping
            join access.permission permission on permission.id=mapping.permission_id where mapping.role_id=assigned.id and mapping.effect='deny'),'[]'::jsonb)) order by assigned.id) items
        from (select distinct role.id,role.name,role.description,role.status,role.kind,role.template_code,role.version from access.membershiprole assignment
          join access.role role on role.id=assignment.role_id and role.status='active'
          where assignment.membership_id=membership.id and assignment.effective_at<=clock_timestamp()
            and (assignment.expires_at is null or assignment.expires_at>clock_timestamp())) assigned
      ) roleitems on true
      left join lateral (
        select jsonb_agg(jsonb_build_object('id',scopegrant.id,'kind',scopegrant.scope_kind,'scope',scopegrant.scope_id,
          'effect',scopegrant.effect,'expires',scopegrant.expires_at) order by scopegrant.id) items
        from access.scopegrant scopegrant where scopegrant.membership_id=membership.id
          and scopegrant.effective_at<=clock_timestamp() and (scopegrant.expires_at is null or scopegrant.expires_at>clock_timestamp())
      ) scopeitems on true
      left join lateral (
        select jsonb_agg(jsonb_build_object('permission',permission.code,'effect',override.effect,'expires',override.expires_at)
          order by permission.code) items from access.membershipoverride override
        join access.permission permission on permission.id=override.permission_id where override.membership_id=membership.id
          and override.revoked_at is null and override.effective_at<=clock_timestamp()
          and (override.expires_at is null or override.expires_at>clock_timestamp())
      ) overrideitems on true
      where access.membership_visible_to($1,membership.id)
        and ($2::text is null or membership.id>$2)
      order by membership.id limit $3`,
      [input.organization, input.after, input.limit]
    );
    return Object.freeze(
      result.rows.map((row) =>
        Object.freeze({
          id: row.id,
          displayName: row.display_name ?? row.id,
          employeeNo: row.employee_no,
          mobileMasked: row.mobile_masked,
          client: membershipTarget(row.client),
          status: row.status,
          accessVersion: Number(row.access_version),
          roles: Object.freeze([...row.roles]),
          scopes: Object.freeze([...row.scopes]),
          overrides: Object.freeze([...row.overrides]),
        })
      )
    );
  }
  async roles(context: ReadTransactionContext, scope: string): Promise<readonly RoleDirectoryRecord[]> {
    interface DirectoryRow {
      readonly id: string;
      readonly name: string;
      readonly description: string;
      readonly status: 'active' | 'disabled';
      readonly kind: 'custom' | 'system' | 'owner';
      readonly template_code: import('../../domain/model/Role').RoleTemplateCode | null;
      readonly version: number;
      readonly allows: string[];
      readonly denies: string[];
      readonly affected_people: number;
      readonly affected_scopes: number;
      readonly members: Array<{ membership: string; displayName: string; accessVersion: number }>;
    }
    const result = await this.transactions.database(context).query<DirectoryRow>(
      `select role.id,role.name,role.description,role.status,role.kind,role.template_code,role.version,
      coalesce((select jsonb_agg(permission.code order by permission.code) from access.rolepermission mapping
        join access.permission permission on permission.id=mapping.permission_id where mapping.role_id=role.id and mapping.effect='allow'),'[]'::jsonb) allows,
      coalesce((select jsonb_agg(permission.code order by permission.code) from access.rolepermission mapping
        join access.permission permission on permission.id=mapping.permission_id where mapping.role_id=role.id and mapping.effect='deny'),'[]'::jsonb) denies,
      count(distinct assignment.membership_id)::integer affected_people,
      count(distinct (grantrow.scope_kind,grantrow.scope_id))::integer affected_scopes,
      coalesce(jsonb_agg(distinct jsonb_build_object('membership',member.id,'displayName',coalesce(profile.display_name,member.id),
        'accessVersion',member.access_version)) filter(where member.id is not null),'[]'::jsonb) members
      from access.role role
      left join access.membershiprole assignment on assignment.role_id=role.id and assignment.effective_at<=clock_timestamp()
        and (assignment.expires_at is null or assignment.expires_at>clock_timestamp())
      left join access.membership member on member.id=assignment.membership_id
      left join access.memberprofile profile on profile.member_id=member.member_id
      left join access.scopegrant grantrow on grantrow.membership_id=assignment.membership_id
        and grantrow.effective_at<=clock_timestamp() and (grantrow.expires_at is null or grantrow.expires_at>clock_timestamp())
      where role.scope_id=$1 and access.scope_allowed(role.scope_id)
      group by role.id,role.name,role.description,role.status,role.kind,role.template_code,role.version
      order by case role.kind when 'owner' then 0 when 'system' then 1 else 2 end,role.name,role.id`,
      [scope]
    );
    return Object.freeze(result.rows.map((row) => Object.freeze({
      id: row.id,
      name: row.name,
      description: row.description,
      status: row.status,
      kind: row.kind,
      template: row.template_code,
      version: Number(row.version),
      allows: Object.freeze([...row.allows]),
      denies: Object.freeze([...row.denies]),
      affectedPeople: Number(row.affected_people),
      affectedScopes: Number(row.affected_scopes),
      members: Object.freeze(row.members.map((member) => Object.freeze({ ...member, accessVersion: Number(member.accessVersion) }))),
    })));
  }
  async roleTemplates(context: ReadTransactionContext) {
    const result = await this.transactions.database(context).query<Readonly<{
      code: import('../../domain/model/Role').RoleTemplateCode;
      name: string;
      description: string;
      allows: string[];
      denies: string[];
      version: number;
    }>>(
      `select code,name,description,allows,denies,version from access.roletemplate
      where state='active' order by case code when 'malloperator' then 0 when 'catalogoperator' then 1
        when 'ordersupport' then 2 when 'financeoperator' then 3 when 'financereviewer' then 4
        when 'administrator' then 5 else 6 end`,
      []
    );
    return Object.freeze(result.rows.map((row) => Object.freeze({ ...row, version: Number(row.version), allows: Object.freeze([...row.allows]), denies: Object.freeze([...row.denies]) })));
  }
  async separationRules(context: ReadTransactionContext) {
    const result = await this.transactions.database(context).query<Readonly<{ left_permission: string; right_permission: string; reason: string }>>(
      `select left_permission,right_permission,reason from access.separationrule where state='active' order by left_permission,right_permission`,
      []
    );
    return Object.freeze(result.rows.map((row) => Object.freeze({ left: row.left_permission, right: row.right_permission, reason: row.reason })));
  }
  async lockRole(context: WriteTransactionContext, role: string, scope: string): Promise<Role | null> {
    const database = this.transactions.database(context);
    const result = await database.query<RoleRow>(
      `select id,scope_id,name,description,status,version,kind,template_code from access.role
      where id=$1 and scope_id=$2 for update`,
      [role, scope]
    );
    return result.rows[0] ? roleModel(result.rows[0]) : null;
  }
  async rolePermissions(context: ReadTransactionContext, role: string) {
    const result = await this.transactions.database(context).query<Readonly<{ code: string; effect: PermissionEffect }>>(
      `select permission.code,mapping.effect from access.rolepermission mapping
      join access.permission permission on permission.id=mapping.permission_id
      where mapping.role_id=$1 order by permission.code,mapping.effect`,
      [role]
    );
    return Object.freeze({
      allows: Object.freeze(result.rows.filter((row) => row.effect === 'allow').map((row) => row.code)),
      denies: Object.freeze(result.rows.filter((row) => row.effect === 'deny').map((row) => row.code)),
    });
  }
  async roleImpact(context: ReadTransactionContext, role: string) {
    const result = await this.transactions.database(context).query<Readonly<{ people: number; scopes: number }>>(
      `select count(distinct assignment.membership_id)::integer people,
      count(distinct (grantrow.scope_kind,grantrow.scope_id))::integer scopes
      from access.membershiprole assignment
      left join access.scopegrant grantrow on grantrow.membership_id=assignment.membership_id
        and grantrow.effective_at<=clock_timestamp() and (grantrow.expires_at is null or grantrow.expires_at>clock_timestamp())
      where assignment.role_id=$1 and assignment.effective_at<=clock_timestamp()
        and (assignment.expires_at is null or assignment.expires_at>clock_timestamp())`,
      [role]
    );
    return Object.freeze({ people: Number(result.rows[0]?.people ?? 0), scopes: Number(result.rows[0]?.scopes ?? 0) });
  }
  async roleTemplate(context: ReadTransactionContext, code: string) {
    const result = await this.transactions.database(context).query<Readonly<{ code: import('../../domain/model/Role').RoleTemplateCode; name: string; description: string; allows: readonly string[]; denies: readonly string[]; version: number }>>(
      `select code,name,description,allows,denies,version from access.roletemplate where code=$1 and state='active'`,
      [code]
    );
    const row = result.rows[0];
    return row ? Object.freeze({ code: row.code, name: row.name, description: row.description, allows: Object.freeze([...row.allows]), denies: Object.freeze([...row.denies]), version: Number(row.version) }) : null;
  }
  async saveRole(
    context: WriteTransactionContext,
    input: Readonly<{
      role: string;
      scope: string;
      name: string;
      description: string;
      allows: readonly string[];
      denies: readonly string[];
      expectedVersion: number;
      template: string | null;
    }>
  ): Promise<RoleChange | null> {
    const database = this.transactions.database(context);
    const changed = await database.query<RoleRow>(
      `insert into access.role(id,scope_id,name,description,status,version,kind,template_code) values($1,$2,$3,$5,'active',0,'custom',$6)
      on conflict(id) do update set name=excluded.name,description=excluded.description,template_code=excluded.template_code,version=access.role.version+1
      where access.role.scope_id=$2 and access.role.kind='custom' and access.role.version=$4
      returning id,scope_id,name,description,status,version,kind,template_code`,
      [input.role, input.scope, input.name, input.expectedVersion, input.description, input.template]
    );
    const row = changed.rows[0];
    if (!row) return null;
    await database.query('delete from access.rolepermission where role_id=$1', [input.role]);
    const permissions = await database.query<Readonly<{ effect: PermissionEffect }>>(
      `with requested as (
        select code,'allow'::text effect from unnest($2::text[]) code
        union all select code,'deny'::text effect from unnest($3::text[]) code
      ) insert into access.rolepermission(role_id,permission_id,effect)
      select $1,permission.id,requested.effect from requested
      join access.permission permission on permission.code=requested.code and permission.status='active'
      returning effect`,
      [input.role, input.allows, input.denies]
    );
    return Object.freeze({
      role: roleModel(row),
      allowCount: permissions.rows.filter((permission) => permission.effect === 'allow').length,
      denyCount: permissions.rows.filter((permission) => permission.effect === 'deny').length,
    });
  }
  async setRoleStatus(context: WriteTransactionContext, role: string, scope: string, status: 'active' | 'disabled', expectedVersion: number): Promise<Role | null> {
    const result = await this.transactions.database(context).query<RoleRow>(
      `update access.role set status=$3,version=version+1 where id=$1 and scope_id=$2 and kind='custom' and version=$4 and status<>$3
      returning id,scope_id,name,description,status,version,kind,template_code`,
      [role, scope, status, expectedVersion]
    );
    return result.rows[0] ? roleModel(result.rows[0]) : null;
  }
  async deleteRole(context: WriteTransactionContext, role: string, scope: string, expectedVersion: number): Promise<boolean> {
    const result = await this.transactions.database(context).query(
      `delete from access.role where id=$1 and scope_id=$2 and kind='custom' and version=$3
      and not exists(select 1 from access.membershiprole where role_id=$1) returning id`,
      [role, scope, expectedVersion]
    );
    return Boolean(result.rows[0]);
  }
  async assignRole(context: WriteTransactionContext, role: string, membership: string, issuer: string): Promise<boolean> {
    const result = await this.transactions.database(context).query(
      `insert into access.membershiprole(membership_id,role_id,effective_at,delegated_by)
      select member.id,role.id,clock_timestamp(),$3 from access.membership member join access.role role
        on role.id=$1 and role.scope_id=member.organization_id and role.status='active' and role.kind='custom'
      where member.id=$2 and member.status='active' and access.scope_allowed(member.organization_id)
        and not exists(select 1 from access.membershiprole current where current.membership_id=member.id and current.role_id=role.id
          and current.effective_at<=clock_timestamp() and (current.expires_at is null or current.expires_at>clock_timestamp()))
      returning membership_id`,
      [role, membership, issuer]
    );
    return Boolean(result.rows[0]);
  }
  async revokeRole(context: WriteTransactionContext, role: string, membership: string): Promise<boolean> {
    const result = await this.transactions.database(context).query(
      `update access.membershiprole assignment set expires_at=clock_timestamp()
      from access.role role,access.membership member where assignment.role_id=role.id and assignment.membership_id=member.id
        and role.id=$1 and role.kind='custom' and member.id=$2 and access.scope_allowed(member.organization_id)
        and assignment.effective_at<=clock_timestamp() and (assignment.expires_at is null or assignment.expires_at>clock_timestamp())
      returning assignment.membership_id`,
      [role, membership]
    );
    return result.rows.length > 0;
  }
  async scopePath(context: ReadTransactionContext, scope: string, kind: string): Promise<string | null> {
    const database = this.transactions.database(context);
    const result = await database.query<{
      path: string;
    }>(
      `select (access.scope_object($1)->'path')::text path
      where access.scope_allowed($1) and access.scope_object($1)->>'kind'=$2`,
      [scope, kind]
    );
    return result.rows[0]?.path ?? null;
  }
  async grantScope(
    context: WriteTransactionContext,
    input: Readonly<{
      id: string;
      membership: string;
      kind: string;
      scope: string;
      path: string;
      effect: PermissionEffect;
      expiresAt: Date | null;
      expectedVersion: number;
    }>
  ): Promise<Scope | null> {
    const database = this.transactions.database(context);
    const result = await database.query<ScopeRow>(
      `insert into access.scopegrant(id,membership_id,scope_kind,scope_id,scope_path,
      effect,effective_at,expires_at,access_version)
      select $1,subject.id,$3,$4,$5,$6,clock_timestamp(),$7,subject.access_version+1
      from access.membership subject where subject.id=$2 and subject.status='active' and subject.access_version=$8
        and access.scope_allowed(subject.organization_id)
      on conflict(membership_id,scope_kind,scope_id) do update set id=excluded.id,scope_path=excluded.scope_path,
        effect=excluded.effect,effective_at=excluded.effective_at,expires_at=excluded.expires_at,
        access_version=excluded.access_version
      returning id,membership_id,scope_kind,scope_id,scope_path,effect,expires_at`,
      [input.id, input.membership, input.kind, input.scope, input.path, input.effect, input.expiresAt, input.expectedVersion]
    );
    const row = result.rows[0];
    return row ? scopeModel(row) : null;
  }
  async lockOverrideTarget(context: WriteTransactionContext, membership: string): Promise<OverrideTarget | null> {
    const database = this.transactions.database(context);
    const result = await database.query<OverrideTargetRow>(
      `select membership.id,membership.organization_id,membership.client,
      membership.status,membership.access_version,exists(select 1 from access.membershiprole assignment
        join access.role role on role.id=assignment.role_id where assignment.membership_id=membership.id
        and role.kind='owner' and role.status='active' and assignment.effective_at<=clock_timestamp()
        and (assignment.expires_at is null or assignment.expires_at>clock_timestamp())) owner
      from access.membership membership where membership.id=$1 and membership.status='active'
        and access.scope_allowed(membership.organization_id) for update`,
      [membership]
    );
    const row = result.rows[0];
    return row ? Object.freeze({ membership: membershipModel(row), owner: row.owner }) : null;
  }
  async setOverride(context: WriteTransactionContext, value: Override, issuer: string): Promise<OverrideChange | null> {
    const database = this.transactions.database(context);
    const result = await database.query<OverrideRow>(
      `insert into access.membershipoverride(membership_id,permission_id,effect,
        granted_by,reason,effective_at,expires_at,revoked_at)
      select $1,permission.id,$3,$4,$5,clock_timestamp(),$6,null from access.permission permission
      where permission.code=$2 and permission.status='active'
      on conflict(membership_id,permission_id) do update set effect=excluded.effect,granted_by=excluded.granted_by,
        reason=excluded.reason,effective_at=excluded.effective_at,expires_at=excluded.expires_at,revoked_at=null
      returning effect,expires_at`,
      [value.membership, value.permission, value.effect, issuer, value.reason, value.expiresat]
    );
    return overrideChange(result.rows[0]);
  }
  async revokeOverride(
    context: WriteTransactionContext,
    input: Readonly<{
      membership: string;
      permission: string;
      reason: string;
    }>
  ): Promise<OverrideChange | null> {
    const database = this.transactions.database(context);
    const result = await database.query<OverrideRow>(
      `update access.membershipoverride override set revoked_at=clock_timestamp(),
      reason=$3 where override.membership_id=$1 and override.permission_id=(select id from access.permission where code=$2)
        and override.revoked_at is null and override.effective_at<=clock_timestamp()
      returning override.effect,override.expires_at`,
      [input.membership, input.permission, input.reason]
    );
    return overrideChange(result.rows[0]);
  }
}

function membershipTarget(value: string): OperationTarget {
  const target = value === 'operator' ? 'console' : value;
  if (!isOperationTarget(target) || target === 'miniapp') throw new Error('MEMBERSHIP_CLIENT_INVALID');
  return target;
}
