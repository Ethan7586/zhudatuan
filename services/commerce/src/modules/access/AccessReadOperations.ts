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
      const result = await database.query(`select membership.id,membership.status,membership.access_version,
        coalesce(jsonb_agg(distinct jsonb_build_object('role',role.id,'name',role.name)) filter(where role.id is not null),'[]') roles,
        coalesce(jsonb_agg(distinct jsonb_build_object('id',scopegrant.id,'kind',scopegrant.scope_kind,'scope',scopegrant.scope_id,'effect',scopegrant.effect,'expires',scopegrant.expires_at)) filter(where scopegrant.id is not null),'[]') scopes
        from access.membership membership left join access.membershiprole assignment on assignment.membership_id=membership.id
        left join access.role role on role.id=assignment.role_id left join access.scopegrant scopegrant on scopegrant.membership_id=membership.id
        where exists(select 1 from organization.unitclosure boundary
          where boundary.ancestor_id=$1 and boundary.descendant_id=membership.organization_id)
        and ($2::text is null or membership.id>$2)
        group by membership.id order by membership.id limit $3`, [access.scope.id, page.id, page.fetch]);
      return keysetResult(result, page, 'id');
    },
  };
}

export function accessOperatorReadOperations(context: ModuleContext): ModuleOperations {
  return new ModuleOperations('access', context.container.get(DATABASE_POOL), context.container.get(AUDIT_SINK),
    accessOperatorReadActions(), ACCESS_OPERATOR_READ_OPERATION_IDS);
}
