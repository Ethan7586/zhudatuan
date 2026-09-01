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
  VersionChange,
} from '../../application/port/AccessRepository';
import type { Membership } from '../../domain/model/Membership';
import type { Override } from '../../domain/model/Override';
import { Role, type PermissionEffect } from '../../domain/model/Role';
import type { Scope } from '../../domain/model/Scope';
import { PgAccessGovernanceRepository } from './PgAccessGovernanceRepository';
import { membershipModel, overrideChange, roleModel, scopeModel, type CenterRow, type MembershipRow, type OverrideRow, type OverrideTargetRow, type RoleRow, type ScopeRow } from './AccessRecord';
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
      `select membership.id,
      case membership.client when 'storefront' then 'storefront' else 'console' end client,
      membership.status,membership.access_version,
      coalesce(roleitems.items,'[]'::jsonb) roles,
      coalesce(scopeitems.items,'[]'::jsonb) scopes,
      coalesce(overrideitems.items,'[]'::jsonb) overrides
      from access.membership membership
      left join lateral (
        select jsonb_agg(jsonb_build_object('role',assigned.id,'name',assigned.name,'kind',assigned.kind,'version',assigned.version,
          'allows',coalesce((select jsonb_agg(permission.code order by permission.code) from access.rolepermission mapping
            join access.permission permission on permission.id=mapping.permission_id where mapping.role_id=assigned.id and mapping.effect='allow'),'[]'::jsonb),
          'denies',coalesce((select jsonb_agg(permission.code order by permission.code) from access.rolepermission mapping
            join access.permission permission on permission.id=mapping.permission_id where mapping.role_id=assigned.id and mapping.effect='deny'),'[]'::jsonb)) order by assigned.id) items
        from (select distinct role.id,role.name,role.kind,role.version from access.membershiprole assignment
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
      where membership.organization_id=$1 and ($2::text is null or membership.id>$2)
      order by membership.id limit $3`,
      [input.organization, input.after, input.limit]
    );
    return Object.freeze(
      result.rows.map((row) =>
        Object.freeze({
          id: row.id,
          client: row.client === 'storefront' ? 'storefront' : 'console',
          status: row.status,
          accessVersion: Number(row.access_version),
          roles: Object.freeze([...row.roles]),
          scopes: Object.freeze([...row.scopes]),
          overrides: Object.freeze([...row.overrides]),
        })
      )
    );
  }
  async lockRole(context: WriteTransactionContext, role: string, scope: string): Promise<Role | null> {
    const database = this.transactions.database(context);
    const result = await database.query<RoleRow>(
      `select id,scope_id,name,status,version,kind from access.role
      where id=$1 and scope_id=$2 for update`,
      [role, scope]
    );
    return result.rows[0] ? roleModel(result.rows[0]) : null;
  }
  async saveRole(
    context: WriteTransactionContext,
    input: Readonly<{
      role: string;
      scope: string;
      name: string;
      allows: readonly string[];
      denies: readonly string[];
      expectedVersion: number;
    }>
  ): Promise<RoleChange | null> {
    const database = this.transactions.database(context);
    const changed = await database.query<RoleRow>(
      `insert into access.role(id,scope_id,name,status,version,kind) values($1,$2,$3,'active',0,'custom')
      on conflict(id) do update set name=excluded.name,status='active',version=access.role.version+1
      where access.role.scope_id=$2 and access.role.kind='custom' and access.role.version=$4
      returning id,scope_id,name,status,version,kind`,
      [input.role, input.scope, input.name, input.expectedVersion]
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
