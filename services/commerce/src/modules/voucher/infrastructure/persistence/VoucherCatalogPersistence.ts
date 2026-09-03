import type { VoucherPersistence } from './VoucherAction';
import { randomUUID } from 'node:crypto';
import { DomainError } from '../../../../foundation/domain/DomainError';
import { requireAccess } from '../../../../foundation/application/OperationAccess';
import { rowResult } from '../../../../adapter/database/DatabaseResult';

import { bodyRecord, integerField, keysetResult, queryPage, textField } from '../../../../foundation/interface/Validation';
import { organizationScope } from '../../../../foundation/security/OrganizationScope';
import type { OrganizationReadPort } from '../../../organization/public';

export function voucherCatalogPersistence(organizations: Pick<OrganizationReadPort, 'descendants'>): Pick<VoucherPersistence, 'read' | 'allocate' | 'manageProgram' | 'readPrograms' | 'requestReserve' | 'decideReserve' | 'readReserves'> {
  return {
    read: async (request, database) => {
      requireAccess(request);
      const page = queryPage(request.input);
      const result = await database.query(
        `select pool.id,pool.scope_id,pool.code_prefix,pool.next_sequence,pool.provider,pool.mode,pool.status,pool.version,
      import.state import_state,import.total_count,import.success_count,import.failure_count,
      coalesce((select jsonb_agg(jsonb_build_object('scope',allocation.scope_id,'quantity',allocation.quantity,'used',allocation.used_count,
        'available',allocation.quantity-allocation.used_count,'version',allocation.version) order by allocation.scope_id)
        from voucher.allocation allocation where allocation.cardpool_id=pool.id),'[]'::jsonb) allocations,
      coalesce((select jsonb_agg(jsonb_build_object('row',problem.row_number,'code',problem.reason_code) order by problem.row_number)
        from (select row_number,reason_code from voucher.importerror where job_id=import.id order by row_number limit 50) problem),'[]'::jsonb) errors
      from voucher.cardpool pool left join voucher.importjob import on import.cardpool_id=pool.id
      where (access.scope_allowed(pool.scope_id) or exists(select 1 from voucher.allocation allocation where allocation.cardpool_id=pool.id
        and access.scope_allowed(allocation.scope_id))) and ($1::text is null or pool.id>$1) order by pool.id limit $2`,
        [page.id, page.fetch]
      );
      return keysetResult(result, page, 'id');
    },
    allocate: async (request, database) => {
      const access = requireAccess(request);
      const body = bodyRecord(request.input);
      const target = textField(body, 'scope');
      const quantity = integerField(body, 'count', 1);
      const allowed = await organizations.descendants(database.transaction, organizationScope(access.scope));
      if (!allowed.includes(target) || target === access.scope.id) throw new Error('CARD_LIBRARY_ALLOCATION_SCOPE_INVALID');
      const poolrecord = await database.query<{ mode: string; available: number; committed: number }>(
        `select pool.mode,
      (select count(*)::integer from voucher.card where cardpool_id=pool.id and state='available') available,
      (select coalesce(sum(quantity-used_count),0)::integer from voucher.allocation where cardpool_id=pool.id) committed
      from voucher.cardpool pool where pool.id=$1 and pool.scope_id=$2 and pool.status='ready' for update`,
        [request.input.path.libraryid!, access.scope.id]
      );
      if (!poolrecord.rows[0]) throw new Error('CARD_LIBRARY_ALLOCATION_CONFLICT');
      if (poolrecord.rows[0].mode === 'imported' && poolrecord.rows[0].available - poolrecord.rows[0].committed < quantity) {
        throw new Error('CARD_LIBRARY_ALLOCATION_INSUFFICIENT');
      }
      const result = await database.query(
        `insert into voucher.allocation(id,cardpool_id,scope_id,quantity,used_count,version,created_at,updated_at)
      values($1,$2,$3,$4,0,0,clock_timestamp(),clock_timestamp()) on conflict(cardpool_id,scope_id) do update
      set quantity=voucher.allocation.quantity+excluded.quantity,version=voucher.allocation.version+1,updated_at=clock_timestamp()
      returning id,cardpool_id,scope_id,quantity,used_count,quantity-used_count available,version`,
        [`allocation:${randomUUID()}`, request.input.path.libraryid!, target, quantity]
      );
      return rowResult(result);
    },
    manageProgram: async (request, database) => {
      const access = requireAccess(request);
      const body = bodyRecord(request.input);
      const status = textField(body, 'status', 16);
      if (!['draft', 'active', 'paused', 'retired'].includes(status)) throw new Error('VOUCHER_PROGRAM_STATUS_INVALID');
      const result = await database.query<{ id: string; value_minor: number; default_valid_days: number; approval_required: boolean; status: string; version: number }>(
        `insert into voucher.program(id,scope_id,name,value_minor,default_valid_days,currency,status,approval_required,version)
      values($1,$2,$3,$4,$5,'CNY',$6,$7,1) on conflict(id) do update set name=excluded.name,value_minor=excluded.value_minor,default_valid_days=excluded.default_valid_days,status=excluded.status,
      approval_required=excluded.approval_required,version=voucher.program.version+1 where voucher.program.scope_id=$2
      and ($8::bigint is null or voucher.program.version=$8) returning *`,
        [request.input.path.programid!, access.scope.id, textField(body, 'name'), integerField(body, 'valueMinor', 1), integerField(body, 'validityDays', 1), status, body.approvalRequired !== false, request.input.expectedVersion ?? null]
      );
      if (!result.rows[0]) throw new DomainError('VERSION_CONFLICT');
      const changed = result.rows[0];
      await database.query(
        `insert into voucher.programversion(program_id,version,value_minor,default_valid_days,approval_required,status,changed_by,changed_at)
      values($1,$2,$3,$4,$5,$6,$7,clock_timestamp())`,
        [changed.id, changed.version, changed.value_minor, changed.default_valid_days, changed.approval_required, changed.status, access.actor.id]
      );
      return rowResult(result);
    },
    readPrograms: async (request, database) => {
      requireAccess(request);
      const page = queryPage(request.input);
      const result = await database.query(
        `select program.id,program.scope_id,program.name,program.value_minor,program.currency,program.default_valid_days,
      program.status,program.approval_required,program.version,coalesce((select jsonb_agg(jsonb_build_object('version',version.version,
        'valueMinor',version.value_minor,'validityDays',version.default_valid_days,'approvalRequired',version.approval_required,'status',version.status,
        'changedBy',version.changed_by,'changedAt',to_char(version.changed_at at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')) order by version.version desc) from voucher.programversion version
        where version.program_id=program.id),'[]'::jsonb) versions from voucher.program program
      where access.scope_allowed(program.scope_id) and ($1::text is null or program.id>$1) order by program.id limit $2`,
        [page.id, page.fetch]
      );
      return keysetResult(result, page, 'id');
    },
    requestReserve: async (request, database) => {
      const access = requireAccess(request);
      const body = bodyRecord(request.input);
      const count = integerField(body, 'count', 1);
      const program = await database.query<{ value_minor: number; version: number }>("select value_minor::float8 value_minor,version::integer from voucher.program where id=$1 and scope_id=$2 and status='active'", [
        body.program,
        access.scope.id,
      ]);
      if (!program.rows[0]) throw new Error('VOUCHER_PROGRAM_INACTIVE');
      const id = `reserve:${randomUUID()}`;
      const result = await database.query(
        `insert into voucher.reserverequest(id,request_number,scope_id,program_id,program_version,requested_count,requested_minor,reason,state,requested_by,submitted_at,created_at,updated_at)
      values($1,$2,$3,$4,$5,$6,$7,$8,'submitted',$9,clock_timestamp(),clock_timestamp(),clock_timestamp()) returning *`,
        [id, `VR${Date.now()}${randomUUID().slice(0, 8)}`, access.scope.id, body.program, program.rows[0].version, count, count * program.rows[0].value_minor, textField(body, 'reason', 1000), access.actor.id]
      );
      return rowResult(result, 201);
    },
    decideReserve: async (request, database) => {
      const access = requireAccess(request);
      const body = bodyRecord(request.input);
      const decision = body.decision === 'approved' ? 'approved' : 'rejected';
      const result = await database.query<{ id: string; requested_by: string }>(
        `update voucher.reserverequest set state=$2,resolved_at=clock_timestamp(),resolved_by=$3,updated_at=clock_timestamp()
      where id=$1 and state='submitted' and requested_by<>$3 returning id,requested_by`,
        [request.input.path.reserveid!, decision, access.actor.id]
      );
      if (!result.rows[0]) throw new Error('VOUCHER_DECISION_CONFLICT_OR_SEPARATION');
      await database.query(
        `insert into voucher.approval(id,request_id,sequence,decision,reason,evidence,actor_id,membership_id,grant_evidence,trace_id,occurred_at)
      values($1,$2,1,$3,$4,$5,$6,$7,$8::jsonb,$9,clock_timestamp())`,
        [
          `approval:${randomUUID()}`,
          request.input.path.reserveid!,
          decision,
          textField(body, 'reason', 1000),
          body.evidence ?? null,
          access.actor.id,
          access.membership.id,
          JSON.stringify({ permission: 'voucher.reserve.decide', scope: access.scope }),
          access.trace,
        ]
      );
      return rowResult(result);
    },
    readReserves: async (request, database) => {
      requireAccess(request);
      const page = queryPage(request.input);
      const result = await database.query(
        `select request.id,request.request_number,request.program_id,program.name,request.requested_count,
      request.program_version,request.requested_minor,request.reason,request.state,request.requested_by,request.submitted_at,request.resolved_by,request.resolved_at,
      request.created_at,coalesce(jsonb_agg(jsonb_build_object('sequence',approval.sequence,'decision',approval.decision,'reason',approval.reason,
        'actor',approval.actor_id,'occurredAt',approval.occurred_at) order by approval.sequence) filter(where approval.request_id is not null),'[]'::jsonb) approvals
      from voucher.reserverequest request join voucher.program program on program.id=request.program_id
      left join voucher.approval approval on approval.request_id=request.id where access.scope_allowed(request.scope_id)
      and ($1::timestamptz is null or (request.created_at,request.id)<($1::timestamptz,$2)) group by request.id,program.name
      order by request.created_at desc,request.id desc limit $3`,
        [page.sort, page.id, page.fetch]
      );
      return keysetResult(result, page, 'created_at');
    },
  };
}
