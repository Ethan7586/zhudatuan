import { randomUUID } from 'node:crypto';
import type { ModuleContext } from '../../../bootstrap/ModuleRegistry';
import { prepareImport, projectImport } from '../../../foundation/application/ImportOperations';
import { operationLifecycle, requireAccess, rowResult, type OperationActions } from '../../../foundation/application/ModuleOperations';
import { OBJECT_STORE } from '../../../foundation/infrastructure/ObjectStore';

export function catalogImportOperations(context: ModuleContext): OperationActions {
  const objects = context.container.get(OBJECT_STORE);
  return {
    'catalog.imports.create': operationLifecycle({
      prepare: (request) => prepareImport(request, objects),
      execute: async (_request, database, prepared) => {
        const id = `catalogimport:${randomUUID()}`;
        const result = await database.query(`insert into catalog.importjob(id,scope_id,object_ref,sha256,state,created_at,updated_at)
          values($1,$2,$3,$4,'uploaded',clock_timestamp(),clock_timestamp()) returning id,state,total_count,cursor_value,success_count,failure_count,created_at,updated_at`,
        [id, prepared.access.scope.id, prepared.reference, prepared.sha256]);
        await database.query(`insert into runtime.job(id,kind,owner,scope_id,payload,state,priority,available_at,created_at,updated_at)
          values($1,'catalogimport','catalog',$2,jsonb_build_object('import',$3),'queued',100,clock_timestamp(),clock_timestamp(),clock_timestamp())`,
        [`job:${id}:0`, prepared.access.scope.id, id]);
        return rowResult(result, 202);
      },
    }),
    'catalog.imports.read': operationLifecycle({
      execute: async (request, database) => {
        const access = requireAccess(request);
        return rowResult(await database.query(`select job.id,job.state,job.total_count,job.cursor_value,job.success_count,job.failure_count,
          job.validation_summary,job.last_error,job.report_object_ref,job.report_sha256,job.report_size,job.created_at,job.updated_at,
          coalesce((select jsonb_agg(row_to_json(errorrow) order by errorrow.row_number,errorrow.reason_code) from
            (select row_number,reason_code,field,detail from catalog.importerror where job_id=job.id order by row_number,reason_code limit 100) errorrow),'[]'::jsonb) errors
          from catalog.importjob job where job.id=$1 and job.scope_id=$2`, [request.input.path.importid!, access.scope.id]));
      },
      finalize: async (_request, result) => projectImport(result, objects),
    }),
  };
}
