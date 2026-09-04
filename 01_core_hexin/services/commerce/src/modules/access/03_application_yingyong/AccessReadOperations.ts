import type { OperationId } from '@shop/contract';
import type { ModuleContext } from '../../../bootstrap/ModuleRegistry';
import { AUDIT_SINK } from '../../../foundation/application/AuditSink';
import { ModuleOperations, requireAccess, type OperationActions } from '../../../foundation/application/ModuleOperations';
import { keysetResult, queryPage } from '../../../foundation/interface/Validation';
import { DATABASE_POOL } from '../../../foundation/persistence/Pool';

export const ACCESS_OPERATOR_READ_OPERATION_IDS = Object.freeze([
  'access.center.read',
] as const satisfies readonly OperationId[]);

export function accessOperatorReadActions(): OperationActions {
  return {
    'access.center.read': async (request, database) => {
      const access = requireAccess(request);
      const page = queryPage(request, 500);
      const [result, roles] = await Promise.all([
        database.query(`select membership.id,membership.status,membership.access_version,
        profile.display_name,profile.id member_id,membership.employee_no,
        coalesce((select jsonb_agg(jsonb_build_object(
          'role',role.id,'name',role.name,
          'scope',access.scope_object(coalesce(assignment.assigned_scope_id,role.scope_id)),
          'scope_source',coalesce(assignment.scope_source,'inherited'),
          'effective_at',assignment.effective_at,'expires',assignment.expires_at)
          order by role.name,coalesce(assignment.assigned_scope_id,role.scope_id))
          from access.membershiprole assignment join access.role role on role.id=assignment.role_id and role.status='active'
          where assignment.membership_id=membership.id and assignment.effective_at<=clock_timestamp()
            and (assignment.expires_at is null or assignment.expires_at>clock_timestamp())
            and (coalesce(assignment.assigned_scope_id,role.scope_id)=$1 or exists(
              select 1 from organization.unitclosure assignmentboundary where assignmentboundary.ancestor_id=$1
                and assignmentboundary.descendant_id=coalesce(assignment.assigned_scope_id,role.scope_id)))),'[]') roles,
        coalesce((select jsonb_agg(jsonb_build_object('id',scopegrant.id,'kind',scopegrant.scope_kind,
          'scope',scopegrant.scope_id,'effect',scopegrant.effect,'expires',scopegrant.expires_at)
          order by scopegrant.scope_path) from access.scopegrant scopegrant
          where scopegrant.membership_id=membership.id and scopegrant.effective_at<=clock_timestamp()
            and (scopegrant.expires_at is null or scopegrant.expires_at>clock_timestamp())
            and (scopegrant.scope_id=$1 or exists(select 1 from organization.unitclosure grantboundary
              where grantboundary.ancestor_id=$1 and grantboundary.descendant_id=scopegrant.scope_id))),'[]') scopes,
        coalesce(resolved.denies,array[]::text[]) denies,
        coalesce((select jsonb_agg(effective.code order by effective.code) from (
          select distinct permission.value code
          from jsonb_array_elements(coalesce(resolved.grants,'[]'::jsonb)) resolvedgrant
          cross join lateral jsonb_array_elements_text(coalesce(resolvedgrant->'permissions','[]'::jsonb)) permission(value)
          where not(permission.value=any(coalesce(resolved.denies,array[]::text[])))
            and ((resolvedgrant->'scope'->>'id')=$1 or exists(select 1 from organization.unitclosure effectiveboundary
              where effectiveboundary.ancestor_id=$1 and effectiveboundary.descendant_id=(resolvedgrant->'scope'->>'id')))) effective),'[]') effective_permissions
        from access.membership membership join member.profile profile on profile.id=membership.member_id
        left join lateral access.resolve_membership(membership.id) resolved on true
        where exists(select 1 from organization.unitclosure boundary
          where boundary.ancestor_id=$1 and boundary.descendant_id=membership.organization_id)
        and ($2::text is null or membership.id>$2)
        order by membership.id limit $3`, [access.scope.id, page.id, page.fetch]),
        database.query(`select role.id,role.name,role.status,role.version,
          coalesce((select jsonb_agg(permission.code order by permission.code)
            from access.rolepermission mapping join access.permission permission on permission.id=mapping.permission_id
            where mapping.role_id=role.id and mapping.effect='allow'),'[]') permissions,
          (select count(distinct assignment.membership_id) from access.membershiprole assignment
            join access.membership membership on membership.id=assignment.membership_id and membership.status='active'
            where assignment.role_id=role.id and assignment.effective_at<=clock_timestamp()
              and (assignment.expires_at is null or assignment.expires_at>clock_timestamp())
              and exists(select 1 from organization.unitclosure memberboundary
                where memberboundary.ancestor_id=$1 and memberboundary.descendant_id=membership.organization_id)
              and (coalesce(assignment.assigned_scope_id,role.scope_id)=$1 or exists(
                select 1 from organization.unitclosure assignmentboundary where assignmentboundary.ancestor_id=$1
                  and assignmentboundary.descendant_id=coalesce(assignment.assigned_scope_id,role.scope_id)))) member_count,
          coalesce((select jsonb_agg(jsonb_build_object(
            'membership',membership.id,'member_id',profile.id,'display_name',profile.display_name,
            'employee_no',membership.employee_no,'access_version',membership.access_version,
            'scope',access.scope_object(coalesce(assignment.assigned_scope_id,role.scope_id)),
            'scope_source',coalesce(assignment.scope_source,'inherited'),
            'effective_at',assignment.effective_at,'expires',assignment.expires_at)
            order by profile.display_name,membership.id,coalesce(assignment.assigned_scope_id,role.scope_id))
            from access.membershiprole assignment join access.membership membership on membership.id=assignment.membership_id
            join member.profile profile on profile.id=membership.member_id
            where assignment.role_id=role.id and membership.status='active'
              and assignment.effective_at<=clock_timestamp()
              and (assignment.expires_at is null or assignment.expires_at>clock_timestamp())
              and exists(select 1 from organization.unitclosure boundary
                where boundary.ancestor_id=$1 and boundary.descendant_id=membership.organization_id)
              and (coalesce(assignment.assigned_scope_id,role.scope_id)=$1 or exists(
                select 1 from organization.unitclosure assignmentboundary where assignmentboundary.ancestor_id=$1
                  and assignmentboundary.descendant_id=coalesce(assignment.assigned_scope_id,role.scope_id)))),'[]') members,
          coalesce((select jsonb_agg(jsonb_build_object('scope',access.scope_object(scoped.scope_id),
            'source',scoped.scope_source,'member_count',scoped.member_count)
            order by scoped.scope_id,scoped.scope_source) from (
              select coalesce(assignment.assigned_scope_id,role.scope_id) scope_id,
                coalesce(assignment.scope_source,'inherited') scope_source,
                count(distinct assignment.membership_id) member_count
              from access.membershiprole assignment join access.membership membership on membership.id=assignment.membership_id
              where assignment.role_id=role.id and membership.status='active'
                and assignment.effective_at<=clock_timestamp()
                and (assignment.expires_at is null or assignment.expires_at>clock_timestamp())
                and exists(select 1 from organization.unitclosure boundary
                  where boundary.ancestor_id=$1 and boundary.descendant_id=membership.organization_id)
                and (coalesce(assignment.assigned_scope_id,role.scope_id)=$1 or exists(
                  select 1 from organization.unitclosure assignmentboundary where assignmentboundary.ancestor_id=$1
                    and assignmentboundary.descendant_id=coalesce(assignment.assigned_scope_id,role.scope_id)))
              group by coalesce(assignment.assigned_scope_id,role.scope_id),coalesce(assignment.scope_source,'inherited')
            ) scoped),'[]') scopes,
          (role.id in('role:self','role-platform-owner-v2','role-platform-owner-successor-v1','role-zhudatuan-pending-operator')
            or role.id='role-senior-administrator-v1:'||role.scope_id) governance,
          case when role.id='role-platform-owner-v2' then 'owner'
            when role.id='role-senior-administrator-v1:'||role.scope_id then 'senior_administrator'
            when role.id='role-zhudatuan-pending-operator' then 'administrator' end governance_level,
          (role.id not in('role:self','role-platform-owner-v2','role-platform-owner-successor-v1','role-zhudatuan-pending-operator')
            and role.id<>'role-senior-administrator-v1:'||role.scope_id) editable
          from access.role role where role.scope_id=$1 order by governance desc,role.name,role.id`, [access.scope.id]),
      ]);
      const pageResult = keysetResult(result, page, 'id');
      return { ...pageResult, body: { ...(pageResult.body as Readonly<Record<string, unknown>>), roles: roles.rows } };
    },
  };
}

export function accessOperatorReadOperations(context: ModuleContext): ModuleOperations {
  return new ModuleOperations('access', context.container.get(DATABASE_POOL), context.container.get(AUDIT_SINK),
    accessOperatorReadActions(), ACCESS_OPERATOR_READ_OPERATION_IDS);
}
