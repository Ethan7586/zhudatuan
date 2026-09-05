import { requireAccess, type OperationActions } from '../../../../foundation/application/ModuleOperations';
import { keysetResult, queryPage } from '../../../../foundation/interface/Validation';

export function getFinanceAuditOperations(): OperationActions {
  return {
    'finance.audit.read': async (request, database) => {
      const access = requireAccess(request);
      const page = queryPage(request, 200);
      const result = await database.query(
        `select record.id,record.scope_id,record.actor_id,record.actor_type,record.action,
        record.resource_type,record.resource_id,record.before_hash,record.after_hash,record.evidence,record.trace_id,
        record.previous_hash,record.record_hash,record.recorded_at from audit.record record
        where record.scope_id in(select descendant_id from organization.unitclosure where ancestor_id=$1)
          and (record.action like 'finance.%' or record.action like 'invoice.%'
            or record.resource_type in('finance','invoice'))
          and ($2::timestamptz is null or (record.recorded_at,record.id)<($2::timestamptz,$3))
        order by record.recorded_at desc,record.id desc limit $4`,
        [access.scope.id, page.sort, page.id, page.fetch],
      );
      return keysetResult(result, page, 'recorded_at');
    },
  };
}
