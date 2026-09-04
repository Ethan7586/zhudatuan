import type { OperationId } from '@shop/contract';
import type { ModuleContext } from '../../../bootstrap/ModuleRegistry';
import { AUDIT_SINK } from '../../../foundation/application/AuditSink';
import { ModuleOperations, requireAccess, type OperationActions } from '../../../foundation/application/ModuleOperations';
import { keysetResult, queryPage } from '../../../foundation/interface/Validation';
import { DATABASE_POOL } from '../../../foundation/persistence/Pool';

export const QUALIFICATION_OPERATOR_READ_OPERATION_IDS = Object.freeze([
  'qualification.center.read',
] as const satisfies readonly OperationId[]);

export function qualificationOperatorReadActions(): OperationActions {
  return {
    'qualification.center.read': async (request, database) => {
      const access = requireAccess(request);
      const page = queryPage(request, 200);
      const result = await database.query(`select policy.id,policy.name,policy.status,policy.active_version,policy.updated_at,
        version.rule,version.published_at from qualification.policy policy left join qualification.policyversion version
        on version.policy_id=policy.id and version.version=policy.active_version where policy.scope_id=$1
        and ($2::timestamptz is null or (policy.updated_at,policy.id)<($2::timestamptz,$3))
        order by policy.updated_at desc,policy.id desc limit $4`, [access.scope.id, page.sort, page.id, page.fetch]);
      return keysetResult(result, page, 'updated_at');
    },
  };
}

export function qualificationOperatorReadOperations(context: ModuleContext): ModuleOperations {
  return new ModuleOperations('qualification', context.container.get(DATABASE_POOL), context.container.get(AUDIT_SINK),
    qualificationOperatorReadActions(), QUALIFICATION_OPERATOR_READ_OPERATION_IDS);
}
