import type { OperationId } from '@shop/contract';
import type { ModuleContext } from '../../bootstrap/ModuleRegistry';
import { AUDIT_SINK } from '../../foundation/application/AuditSink';
import { ModuleOperations, requireAccess, rowResult, type OperationActions } from '../../foundation/application/ModuleOperations';
import { keysetResult, queryPage } from '../../foundation/interface/Validation';
import { DATABASE_POOL } from '../../foundation/persistence/Pool';

export const VOUCHER_OPERATOR_READ_OPERATION_IDS = Object.freeze([
  'voucher.cardlibraries.read',
  'voucher.programs.read',
  'voucher.reserves.read',
  'voucher.batches.read',
  'voucher.imports.read',
] as const satisfies readonly OperationId[]);

export function voucherOperatorReadActions(): OperationActions {
  return {
    'voucher.cardlibraries.read': async (request, database) => {
      requireAccess(request);
      const page = queryPage(request);
      const result = await database.query(`select pool.id,pool.scope_id,pool.code_prefix,pool.next_sequence,pool.provider,pool.mode,pool.status,pool.version,
        import.state import_state,import.total_count,import.success_count,import.failure_count,
        coalesce((select jsonb_agg(jsonb_build_object('scope',allocation.scope_id,'quantity',allocation.quantity,'used',allocation.used_count,
          'available',allocation.quantity-allocation.used_count,'version',allocation.version) order by allocation.scope_id)
          from voucher.allocation allocation where allocation.cardpool_id=pool.id),'[]'::jsonb) allocations,
        coalesce((select jsonb_agg(jsonb_build_object('row',problem.row_number,'code',problem.reason_code) order by problem.row_number)
          from (select row_number,reason_code from voucher.importerror where job_id=import.id order by row_number limit 50) problem),'[]'::jsonb) errors
        from voucher.cardpool pool left join voucher.importjob import on import.cardpool_id=pool.id
        where (access.scope_allowed(pool.scope_id) or exists(select 1 from voucher.allocation allocation where allocation.cardpool_id=pool.id
          and access.scope_allowed(allocation.scope_id))) and ($1::text is null or pool.id>$1) order by pool.id limit $2`,
      [page.id, page.fetch]);
      return keysetResult(result, page, 'id');
    },
    'voucher.programs.read': async (request, database) => {
      requireAccess(request);
      const page = queryPage(request);
      const result = await database.query(`select program.id,program.scope_id,program.name,program.value_minor,program.currency,program.default_valid_days,
        program.status,program.approval_required,program.version,coalesce((select jsonb_agg(jsonb_build_object('version',version.version,
          'valueMinor',version.value_minor,'validityDays',version.default_valid_days,'approvalRequired',version.approval_required,'status',version.status,
          'changedBy',version.changed_by,'changedAt',version.changed_at) order by version.version desc) from voucher.programversion version
          where version.program_id=program.id),'[]'::jsonb) versions from voucher.program program
        where access.scope_allowed(program.scope_id) and ($1::text is null or program.id>$1) order by program.id limit $2`,
      [page.id, page.fetch]);
      return keysetResult(result, page, 'id');
    },
    'voucher.reserves.read': async (request, database) => {
      requireAccess(request);
      const page = queryPage(request);
      const result = await database.query(`select request.id,request.request_number,request.program_id,program.name,request.requested_count,
        request.program_version,request.requested_minor,request.reason,request.state,request.requested_by,request.submitted_at,request.resolved_by,request.resolved_at,
        request.created_at,coalesce(jsonb_agg(jsonb_build_object('sequence',approval.sequence,'decision',approval.decision,'reason',approval.reason,
          'actor',approval.actor_id,'occurredAt',approval.occurred_at) order by approval.sequence) filter(where approval.request_id is not null),'[]'::jsonb) approvals
        from voucher.reserverequest request join voucher.program program on program.id=request.program_id
        left join voucher.approval approval on approval.request_id=request.id where access.scope_allowed(request.scope_id)
        and ($1::timestamptz is null or (request.created_at,request.id)<($1::timestamptz,$2)) group by request.id,program.name
        order by request.created_at desc,request.id desc limit $3`, [page.sort, page.id, page.fetch]);
      return keysetResult(result, page, 'created_at');
    },
    'voucher.batches.read': async (request, database) => {
      requireAccess(request);
      const page = queryPage(request);
      const result = await database.query(`select batch.id,batch.program_id,batch.program_version,program.name,batch.cardpool_id,batch.reserve_request_id,batch.state,
        batch.requested_count,batch.issued_count,batch.created_at from voucher.issuebatch batch join voucher.program program on program.id=batch.program_id
        where access.scope_allowed(program.scope_id) and ($1::timestamptz is null or (batch.created_at,batch.id)<($1::timestamptz,$2))
        order by batch.created_at desc,batch.id desc limit $3`, [page.sort, page.id, page.fetch]);
      return keysetResult(result, page, 'created_at');
    },
    'voucher.imports.read': async (request, database) => {
      requireAccess(request);
      return rowResult(await database.query(`select job.id,job.cardpool_id,job.state,job.total_count,job.cursor_value,
        job.success_count,job.failure_count,job.validation_summary,job.last_error,job.report_object_ref,job.report_sha256,
        job.report_size,job.created_at,job.updated_at,coalesce((select jsonb_agg(row_to_json(errorrow)
          order by errorrow.row_number) from (select row_number,reason_code,field,detail from voucher.importerror
            where job_id=job.id order by row_number limit 100) errorrow),'[]'::jsonb) errors
        from voucher.importjob job where job.id=$1 and access.scope_allowed(job.scope_id)`,
      [request.input.path.importid!]));
    },
  };
}

export function voucherOperatorReadOperations(context: ModuleContext): ModuleOperations {
  return new ModuleOperations('voucher', context.container.get(DATABASE_POOL), context.container.get(AUDIT_SINK),
    voucherOperatorReadActions(), VOUCHER_OPERATOR_READ_OPERATION_IDS);
}
