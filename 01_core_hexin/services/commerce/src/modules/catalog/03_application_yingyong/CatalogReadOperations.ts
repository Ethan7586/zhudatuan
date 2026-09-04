import type { OperationId } from '@shop/contract';
import type { ModuleContext } from '../../../bootstrap/ModuleRegistry';
import { AUDIT_SINK } from '../../../foundation/application/AuditSink';
import { ModuleOperations, requireAccess, rowResult, type OperationActions } from '../../../foundation/application/ModuleOperations';
import { DATABASE_POOL } from '../../../foundation/persistence/Pool';

export const CATALOG_OPERATOR_READ_OPERATION_IDS = Object.freeze([
  'catalog.imports.read',
] as const satisfies readonly OperationId[]);

export function catalogOperatorReadActions(): OperationActions {
  return {
    'catalog.imports.read': async (request, database) => {
      const access = requireAccess(request);
      return rowResult(await database.query(`select job.id,job.state,job.total_count,job.cursor_value,job.success_count,job.failure_count,
        job.validation_summary,job.last_error,job.report_object_ref,job.report_sha256,job.report_size,job.created_at,job.updated_at,
        coalesce((select jsonb_agg(row_to_json(errorrow) order by errorrow.row_number,errorrow.reason_code) from
          (select row_number,reason_code,field,detail from catalog.importerror where job_id=job.id
            order by row_number,reason_code limit 100) errorrow),'[]'::jsonb) errors
        from catalog.importjob job where job.id=$1 and job.scope_id=$2`,
      [request.input.path.importid!, access.scope.id]));
    },
  };
}

export function catalogOperatorReadOperations(context: ModuleContext): ModuleOperations {
  return new ModuleOperations('catalog', context.container.get(DATABASE_POOL), context.container.get(AUDIT_SINK),
    catalogOperatorReadActions(), CATALOG_OPERATOR_READ_OPERATION_IDS);
}
