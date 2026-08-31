import { DomainError } from '../../../foundation/domain/DomainError';
import { randomUUID } from 'node:crypto';
import type { ModuleContext } from '../../../bootstrap/ModuleRegistry';
import { prepareImport, projectImport } from '../../../foundation/application/ImportOperations';
import { operationLifecycle, requireAccess, rowResult, type OperationActions } from '../../../foundation/application/ModuleOperations';
import { OBJECT_STORE } from '../../../foundation/infrastructure/ObjectStore';

export function inventoryImportOperations(context: ModuleContext): OperationActions {
  const objects = context.service(OBJECT_STORE);
  return {
    'inventory.imports.create': operationLifecycle({
      prepare: (request) => prepareImport(request, objects),
      execute: async (_request, database, prepared) => {
        const id = `inventoryimport:${randomUUID()}`;
        const result = await database.query(
          `insert into inventory.importjob(id,scope_id,object_ref,sha256,state,created_at,updated_at)
          values($1,$2,$3,$4,'uploaded',clock_timestamp(),clock_timestamp()) returning id,state,total_count,cursor_value,success_count,failure_count,created_at,updated_at`,
          [id, prepared.access.scope.id, prepared.reference, prepared.sha256]
        );
        await database.query(
          `insert into runtime.job(id,kind,owner,scope_id,payload,state,priority,available_at,created_at,updated_at)
          values($1,'inventoryimport','inventory',$2,jsonb_build_object('import',$3),'queued',100,clock_timestamp(),clock_timestamp(),clock_timestamp())`,
          [`job:${id}:0`, prepared.access.scope.id, id]
        );
        return rowResult(result, 202);
      },
    }),
    'inventory.imports.read': operationLifecycle({
      execute: async (request, database) => {
        const access = requireAccess(request);
        const id = queryValue(request.input.query.job);
        if (!id) throw new DomainError('VALIDATION_FAILED', { field: 'job' });
        return rowResult(
          await database.query(
            `select job.id,job.state,job.total_count,job.cursor_value,job.success_count,job.failure_count,
          job.validation_summary,job.last_error,job.report_object_ref,job.report_sha256,job.report_size,job.created_at,job.updated_at,
          coalesce((select jsonb_agg(row_to_json(errorrow) order by errorrow.row_number,errorrow.reason_code) from
            (select row_number,reason_code,field,detail from inventory.importerror where job_id=job.id order by row_number,reason_code limit 100) errorrow),'[]'::jsonb) errors
          from inventory.importjob job where job.id=$1 and job.scope_id=$2`,
            [id, access.scope.id]
          )
        );
      },
      finalize: async (_request, result) => projectImport(result, objects),
    }),
  };
}

function queryValue(value: string | readonly string[] | undefined): string {
  return (Array.isArray(value) ? value[0] : value)?.trim().slice(0, 128) ?? '';
}
