import type { OperationId } from '@shop/contract';
import type { ModuleContext } from '../../bootstrap/ModuleRegistry';
import { AUDIT_SINK } from '../../foundation/application/AuditSink';
import { ModuleOperations, requireAccess, type OperationActions } from '../../foundation/application/ModuleOperations';
import { keysetResult, queryPage } from '../../foundation/interface/Validation';
import { DATABASE_POOL } from '../../foundation/persistence/Pool';

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
        coalesce(jsonb_agg(distinct jsonb_build_object('role',role.id,'name',role.name)) filter(where role.id is not null),'[]') roles,
        coalesce(jsonb_agg(distinct jsonb_build_object('id',scopegrant.id,'kind',scopegrant.scope_kind,'scope',scopegrant.scope_id,'effect',scopegrant.effect,'expires',scopegrant.expires_at)) filter(where scopegrant.id is not null),'[]') scopes
        from access.membership membership left join access.membershiprole assignment on assignment.membership_id=membership.id
        left join access.role role on role.id=assignment.role_id left join access.scopegrant scopegrant on scopegrant.membership_id=membership.id
        where exists(select 1 from organization.unitclosure boundary
          where boundary.ancestor_id=$1 and boundary.descendant_id=membership.organization_id)
        and ($2::text is null or membership.id>$2)
        group by membership.id order by membership.id limit $3`, [access.scope.id, page.id, page.fetch]),
        database.query(`select role.id,role.name,role.status,role.version,
          coalesce((select jsonb_agg(permission.code order by permission.code)
            from access.rolepermission mapping join access.permission permission on permission.id=mapping.permission_id
            where mapping.role_id=role.id and mapping.effect='allow'),'[]') permissions,
          (select count(distinct assignment.membership_id) from access.membershiprole assignment
            where assignment.role_id=role.id and assignment.effective_at<=clock_timestamp()
              and (assignment.expires_at is null or assignment.expires_at>clock_timestamp())) member_count,
          role.id in('role-platform-owner-v2','role-platform-owner-successor-v1','role-zhudatuan-pending-operator') governance,
          role.id not in('role-platform-owner-v2','role-platform-owner-successor-v1','role-zhudatuan-pending-operator') editable
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
