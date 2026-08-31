import { DomainError } from '../../foundation/domain/DomainError';
import { randomUUID } from 'node:crypto';
import type { ModuleContext } from '../../bootstrap/ModuleRegistry';
import { AUDIT_SINK } from '../../foundation/application/AuditSink';
import { ModuleOperations, requireAccess, rowResult } from '../../foundation/application/ModuleOperations';
import { bodyRecord, integerField, keysetResult, queryPage, textField } from '../../foundation/interface/Validation';
import { DATABASE_POOL } from '../../foundation/persistence/Pool';
import { organizationScope } from '../../foundation/security/OrganizationScope';
import { voucherQueries } from './VoucherQueries';
import { voucherCatalogOperations } from './VoucherCatalogOperations';
import { voucherImportOperations } from './application/VoucherImportOperations';
import { MEMBER_ACCESS_PORT } from '../access/public';
import { ORGANIZATION_READ_PORT } from '../organization/public';

export function voucherOperations(context: ModuleContext): ModuleOperations {
  const pool = context.service(DATABASE_POOL);
  const members = context.ports.get(MEMBER_ACCESS_PORT);
  const organizations = context.ports.get(ORGANIZATION_READ_PORT);
  return new ModuleOperations('voucher', pool, context.service(AUDIT_SINK), {
    ...voucherImportOperations(context),
    ...voucherCatalogOperations(organizations),
    'voucher.batches.issue': async (request, database) => {
      const access = requireAccess(request);
      const body = bodyRecord(request);
      const count = integerField(body, 'count', 1);
      if (count > 100_000) throw new Error('VOUCHER_BATCH_TOO_LARGE');
      const program = textField(body, 'program');
      const cardpool = textField(body, 'cardpool');
      const configuration = (
        await database.query<{ approval_required: boolean; version: number }>(
          `select approval_required,version::integer from voucher.program
        where id=$1 and scope_id=$2 and status='active' for update`,
          [program, access.scope.id]
        )
      ).rows[0];
      if (!configuration) throw new Error('VOUCHER_PROGRAM_INACTIVE');
      const poolrecord = await database.query<{ id: string; scope_id: string; mode: string; available: number }>(
        `select pool.id,pool.scope_id,pool.mode,
        (select count(*)::integer from voucher.card where cardpool_id=pool.id and state='available') available
        from voucher.cardpool pool where pool.id=$1 and pool.status='ready' and (pool.scope_id=$2 or exists(select 1 from voucher.allocation allocation
          where allocation.cardpool_id=pool.id and allocation.scope_id=$2)) for update`,
        [cardpool, access.scope.id]
      );
      if (!poolrecord.rows[0]) throw new Error('VOUCHER_CARD_LIBRARY_NOT_READY');
      if (poolrecord.rows[0].mode === 'imported') {
        const committed = await database.query<{ count: number }>(
          `select coalesce(sum(quantity-used_count),0)::integer count from voucher.allocation
          where cardpool_id=$1 and ($2::text is null or scope_id<>$2)`,
          [cardpool, poolrecord.rows[0].scope_id === access.scope.id ? null : access.scope.id]
        );
        if (poolrecord.rows[0].available - committed.rows[0]!.count < count) throw new Error('VOUCHER_CARD_LIBRARY_INSUFFICIENT');
      }
      if (poolrecord.rows[0].scope_id !== access.scope.id) {
        const allocated = await database.query(
          `update voucher.allocation set used_count=used_count+$3,version=version+1,updated_at=clock_timestamp()
          where cardpool_id=$1 and scope_id=$2 and quantity-used_count>=$3 returning id`,
          [cardpool, access.scope.id, count]
        );
        if (!allocated.rows[0]) throw new Error('VOUCHER_CARD_LIBRARY_ALLOCATION_INSUFFICIENT');
      }
      const reserve = typeof body.reserve === 'string' && body.reserve.length > 0 ? body.reserve : null;
      let version = configuration.version;
      if (reserve !== null) {
        const approved = await database.query<{ program_version: number }>(
          `update voucher.reserverequest set state='fulfilled',updated_at=clock_timestamp()
          where id=$1 and scope_id=$2 and program_id=$3 and requested_count=$4 and state='approved' returning program_version::integer`,
          [reserve, access.scope.id, program, count]
        );
        if (!approved.rows[0]) throw new Error('VOUCHER_APPROVED_RESERVE_REQUIRED');
        version = approved.rows[0].program_version;
      } else if (configuration.approval_required) throw new Error('VOUCHER_APPROVED_RESERVE_REQUIRED');
      const id = `issuebatch:${randomUUID()}`;
      const result = await database.query(
        `insert into voucher.issuebatch(id,program_id,program_version,cardpool_id,reserve_request_id,state,requested_count,issued_count,created_at)
        values($1,$2,$3,$4,$5,'issuing',$6,0,clock_timestamp()) returning *`,
        [id, program, version, cardpool, reserve, count]
      );
      await database.query(
        `insert into runtime.job(id,kind,owner,scope_id,payload,state,priority,available_at,created_at,updated_at)
        values($1,'voucherissue','voucher',$2,jsonb_build_object('batch',$3),'queued',20,clock_timestamp(),clock_timestamp(),clock_timestamp())`,
        [`job:${id}`, access.scope.id, id]
      );
      return rowResult(result, 202);
    },
    'voucher.batches.read': async (request, database) => {
      requireAccess(request);
      const page = queryPage(request);
      const result = await database.query(
        `select batch.id,batch.program_id,batch.program_version,program.name,batch.cardpool_id,batch.reserve_request_id,batch.state,
        batch.requested_count,batch.issued_count,batch.created_at from voucher.issuebatch batch join voucher.program program on program.id=batch.program_id
        where access.scope_allowed(program.scope_id) and ($1::timestamptz is null or (batch.created_at,batch.id)<($1::timestamptz,$2))
        order by batch.created_at desc,batch.id desc limit $3`,
        [page.sort, page.id, page.fetch]
      );
      return keysetResult(result, page, 'created_at');
    },
    'voucher.batches.retry': async (request, database) => {
      const access = requireAccess(request);
      const batchid = request.input.path.batchid!;
      const batch = await database.query<{ id: string; cardpool_id: string; requested_count: number; issued_count: number; scope_id: string; owner_scope: string; mode: string; available: number }>(
        `select batch.id,batch.cardpool_id,batch.requested_count,batch.issued_count,
        program.scope_id,pool.scope_id owner_scope,pool.mode,(select count(*)::integer from voucher.card where cardpool_id=pool.id and state='available') available
        from voucher.issuebatch batch join voucher.program program on program.id=batch.program_id join voucher.cardpool pool on pool.id=batch.cardpool_id
        where batch.id=$1 and program.scope_id=$2 and batch.state='failed' and pool.status='ready' for update of batch,pool`,
        [batchid, access.scope.id]
      );
      const selected = batch.rows[0];
      if (!selected) throw new Error('VOUCHER_ISSUE_BATCH_NOT_RETRYABLE');
      const remaining = selected.requested_count - selected.issued_count;
      if (remaining <= 0) throw new Error('VOUCHER_ISSUE_BATCH_COMPLETE');
      const active = await database.query(`select 1 from runtime.job where kind='voucherissue' and payload->>'batch'=$1 and state in('queued','running')`, [batchid]);
      if (active.rows[0]) throw new Error('VOUCHER_ISSUE_JOB_ACTIVE');
      if (selected.owner_scope !== selected.scope_id) {
        const reserved = await database.query(
          `update voucher.allocation set used_count=used_count+$3,version=version+1,updated_at=clock_timestamp()
          where cardpool_id=$1 and scope_id=$2 and quantity-used_count>=$3 returning id`,
          [selected.cardpool_id, selected.scope_id, remaining]
        );
        if (!reserved.rows[0]) throw new Error('VOUCHER_CARD_LIBRARY_ALLOCATION_INSUFFICIENT');
      } else if (selected.mode === 'imported') {
        const committed = await database.query<{ count: number }>(
          `select coalesce(sum(quantity-used_count),0)::integer count
          from voucher.allocation where cardpool_id=$1`,
          [selected.cardpool_id]
        );
        if (selected.available - committed.rows[0]!.count < remaining) throw new Error('VOUCHER_CARD_LIBRARY_INSUFFICIENT');
      }
      const result = await database.query(`update voucher.issuebatch set state='issuing' where id=$1 and state='failed' returning *`, [batchid]);
      await database.query(
        `insert into runtime.job(id,kind,owner,scope_id,payload,state,priority,available_at,created_at,updated_at)
        values($1,'voucherissue','voucher',$2,jsonb_build_object('batch',$3),'queued',30,clock_timestamp(),clock_timestamp(),clock_timestamp())`,
        [`job:${randomUUID()}`, selected.scope_id, batchid]
      );
      await database.query(`update runtime.deadletter set reviewed_at=clock_timestamp() where owner='voucher' and payload->>'batch'=$1 and reviewed_at is null`, [batchid]);
      return rowResult(result, 202);
    },
    'voucher.status.batch': async (request, database) => {
      const access = requireAccess(request);
      const body = bodyRecord(request);
      if (!Array.isArray(body.ids) || body.ids.length === 0 || body.ids.length > 100_000 || body.ids.some((id) => typeof id !== 'string' || id.length === 0) || new Set(body.ids).size !== body.ids.length)
        throw new DomainError('VALIDATION_FAILED', { field: 'ids' });
      const action = textField(body, 'action');
      if (!['activate', 'disable', 'extend', 'void'].includes(action)) throw new Error('VOUCHER_BATCH_ACTION_INVALID');
      const reason = textField(body, 'reason', 1000);
      const expires = action === 'extend' ? new Date(textField(body, 'expiresAt')) : null;
      if (expires && (!Number.isFinite(expires.getTime()) || expires.getTime() <= Date.now())) throw new Error('VOUCHER_EXPIRY_INVALID');
      const batchid = `statusbatch:${randomUUID()}`;
      const result = await database.query(
        `insert into voucher.statusbatch(id,scope_id,action,expires_at,reason,actor_id,state,requested_count,
        succeeded_count,failed_count,created_at,updated_at) values($1,$2,$3,$4, $5,$6,'queued',$7,0,0,clock_timestamp(),clock_timestamp()) returning *`,
        [batchid, access.scope.id, action, expires?.toISOString() ?? null, reason, access.actor.id, body.ids.length]
      );
      await database.query(
        `insert into voucher.statusitem(batch_id,voucher_id,state,updated_at)
        select $1,id,'queued',clock_timestamp() from unnest($2::text[]) id`,
        [batchid, body.ids]
      );
      await database.query(
        `insert into runtime.job(id,kind,owner,scope_id,payload,state,priority,available_at,created_at,updated_at)
        values($1,'voucherstatus','voucher',$2,jsonb_build_object('batch',$3),'queued',20,clock_timestamp(),clock_timestamp(),clock_timestamp())`,
        [`job:${batchid}`, access.scope.id, batchid]
      );
      return rowResult(result, 202);
    },
    'voucher.bindings.manage': async (request, database) => {
      const access = requireAccess(request);
      const body = bodyRecord(request);
      const voucherid = request.input.path.voucherid!;
      const member = textField(body, 'member');
      const eligible = await members.activeIn(database, member, await organizations.descendants(database, organizationScope(access.scope)));
      if (!eligible) throw new Error('VOUCHER_MEMBER_SCOPE_INVALID');
      const result = await database.query<{ id: string; state: string; version: number }>(
        `update voucher.voucher voucher set member_id=$3,version=version+1
        from voucher.program program where voucher.id=$1 and voucher.program_id=program.id and program.scope_id=$2
        and voucher.member_id is null and voucher.state='active' returning voucher.id,voucher.state,voucher.version`,
        [voucherid, access.scope.id, member]
      );
      if (!result.rows[0]) throw new Error('VOUCHER_BINDING_CONFLICT');
      await database.query(
        `insert into voucher.statusevent(voucher_id,sequence,previous_state,next_state,reason,actor_id,occurred_at)
        select $1,coalesce(max(sequence),0)+1,'active','active',$2,$3,clock_timestamp() from voucher.statusevent where voucher_id=$1`,
        [voucherid, textField(body, 'reason', 1000), access.actor.id]
      );
      return rowResult(result);
    },
    'voucher.redemptions.reverse': async (request, database) => {
      const access = requireAccess(request);
      const body = bodyRecord(request);
      const result = await database.query<{ id: string; voucher_id: string; amount_minor: number; previous_state: string }>(
        `select redemption.id,
        redemption.voucher_id,redemption.amount_minor::float8 amount_minor,voucher.state previous_state
        from voucher.redemption redemption join voucher.voucher voucher on voucher.id=redemption.voucher_id
        join voucher.program program on program.id=voucher.program_id where redemption.id=$1 and program.scope_id=$2
        and not exists(select 1 from voucher.reversal reversal where reversal.redemption_id=redemption.id and reversal.state='reversed')
        for update of redemption,voucher`,
        [request.input.path.redemptionid!, access.scope.id]
      );
      const redemption = result.rows[0];
      if (!redemption) throw new Error('VOUCHER_REDEMPTION_REVERSAL_CONFLICT');
      const reversal = `reversal:${randomUUID()}`;
      await database.query(
        `insert into voucher.reversal(id,redemption_id,reference_id,amount_minor,state,reason,evidence,occurred_at)
        values($1,$2,$1,$3,'reversed',$4,$5::jsonb,clock_timestamp())`,
        [reversal, redemption.id, redemption.amount_minor, textField(body, 'reason', 1000), JSON.stringify({ actor: access.actor.id, trace: access.trace })]
      );
      const restored = await database.query<{ state: string }>(
        `update voucher.voucher set remaining_minor=remaining_minor+$2,
        state='reversed',version=version+1 where id=$1 and state='redeemed' returning state`,
        [redemption.voucher_id, redemption.amount_minor]
      );
      await database.query(
        `insert into voucher.statusevent(voucher_id,sequence,previous_state,next_state,reason,actor_id,occurred_at)
        select $1,coalesce(max(sequence),0)+1,$2,$3,$4,$5,clock_timestamp() from voucher.statusevent where voucher_id=$1`,
        [redemption.voucher_id, redemption.previous_state, restored.rows[0]!.state, textField(body, 'reason', 1000), access.actor.id]
      );
      return rowResult(result);
    },
    ...voucherQueries(organizations),
  });
}
