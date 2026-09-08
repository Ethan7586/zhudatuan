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
import { membershipTarget } from './MembershipTarget';
export class PgAccessQueryRepository extends PgAccessGovernanceRepository {
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
    return Object.freeze(
      result.rows.map((row) =>
        Object.freeze({
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
        })
      )
    );
  }
  async roleTemplates(context: ReadTransactionContext) {
    const result = await this.transactions.database(context).query<
      Readonly<{
        code: import('../../domain/model/Role').RoleTemplateCode;
        name: string;
        description: string;
        allows: string[];
        denies: string[];
        version: number;
      }>
    >(
      `select code,name,description,allows,denies,version from access.roletemplate
      where state='active' order by case code when 'malloperator' then 0 when 'catalogoperator' then 1
        when 'ordersupport' then 2 when 'financeoperator' then 3 when 'financereviewer' then 4
        when 'administrator' then 5 else 6 end`,
      []
    );
    return Object.freeze(result.rows.map((row) => Object.freeze({ ...row, version: Number(row.version), allows: Object.freeze([...row.allows]), denies: Object.freeze([...row.denies]) })));
  }
  async separationRules(context: ReadTransactionContext) {
    const result = await this.transactions
      .database(context)
      .query<Readonly<{ left_permission: string; right_permission: string; reason: string }>>(`select left_permission,right_permission,reason from access.separationrule where state='active' order by left_permission,right_permission`, []);
    return Object.freeze(result.rows.map((row) => Object.freeze({ left: row.left_permission, right: row.right_permission, reason: row.reason })));
  }
}
