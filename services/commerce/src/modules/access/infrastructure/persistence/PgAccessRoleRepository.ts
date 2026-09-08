import { PgTransactionAccess } from '../../../../platform/database/PgTransactionAccess';
import type { ReadTransactionContext, WriteTransactionContext } from '../../../../platform/database/TransactionContext';
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
import { PgAccessQueryRepository } from './PgAccessQueryRepository';
export class PgAccessRoleRepository extends PgAccessQueryRepository {
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
    const result = await this.transactions
      .database(context)
      .query<
        Readonly<{ code: import('../../domain/model/Role').RoleTemplateCode; name: string; description: string; allows: readonly string[]; denies: readonly string[]; version: number }>
      >(`select code,name,description,allows,denies,version from access.roletemplate where code=$1 and state='active'`, [code]);
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
}
