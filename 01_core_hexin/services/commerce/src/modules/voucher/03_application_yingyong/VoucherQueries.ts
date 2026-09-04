import { requireAccess, type OperationActions } from '../../../foundation/application/ModuleOperations';
import { keysetResult, queryPage } from '../../../foundation/interface/Validation';

export function voucherQueries(): OperationActions {
  return {
    'voucher.statusbatches.read': async (request, database) => {
      requireAccess(request);
      const page = queryPage(request);
      const batch = request.input.query.batch;
      if (typeof batch === 'string' && batch.length > 0) {
        const result = await database.query(`select item.batch_id,item.voucher_id,item.state,item.previous_state,item.next_state,item.error_code,item.updated_at
          from voucher.statusitem item join voucher.statusbatch batch on batch.id=item.batch_id where item.batch_id=$1 and access.scope_allowed(batch.scope_id)
          and ($2::text is null or item.voucher_id>$2) order by item.voucher_id limit $3`, [batch, page.id, page.fetch]);
        return keysetResult(result, page, 'voucher_id');
      }
      const result = await database.query(`select id,action,expires_at,reason,actor_id,state,requested_count,succeeded_count,failed_count,created_at,updated_at
        from voucher.statusbatch where access.scope_allowed(scope_id) and ($1::timestamptz is null or (created_at,id)<($1::timestamptz,$2))
        order by created_at desc,id desc limit $3`, [page.sort, page.id, page.fetch]);
      return keysetResult(result, page, 'created_at');
    },
    'voucher.bindings.read': async (request, database) => {
      const access = requireAccess(request);
      const page = queryPage(request);
      const result = await database.query(`select voucher.id,voucher.program_id,program.name,voucher.member_id,voucher.initial_minor,voucher.remaining_minor,voucher.state,voucher.expires_at,voucher.version,
        coalesce(voucher.expires_at,'infinity') cursor_sort
        from voucher.voucher voucher join voucher.program program on program.id=voucher.program_id where
          (($4 and voucher.member_id=$1) or (not $4 and exists(select 1 from organization.unitclosure where ancestor_id=$1 and descendant_id=program.scope_id)))
          and ($2::timestamptz is null or (coalesce(voucher.expires_at,'infinity'),voucher.id)>($2::timestamptz,$3))
        order by coalesce(voucher.expires_at,'infinity'),voucher.id limit $5`, [access.scope.id, page.sort, page.id, access.scope.kind === 'owner', page.fetch]);
      return keysetResult(result, page, 'cursor_sort');
    },
    'voucher.redemptions.read': async (request, database) => {
      requireAccess(request);
      const page = queryPage(request);
      const result = await database.query(`select redemption.*,voucher.program_id from voucher.redemption redemption join voucher.voucher voucher on voucher.id=redemption.voucher_id
        join voucher.program program on program.id=voucher.program_id where access.scope_allowed(program.scope_id)
        and ($1::timestamptz is null or (redemption.redeemed_at,redemption.id)<($1::timestamptz,$2))
        order by redemption.redeemed_at desc,redemption.id desc limit $3`, [page.sort, page.id, page.fetch]);
      return keysetResult(result, page, 'redeemed_at');
    },
    'voucher.history.read': async (request, database) => {
      requireAccess(request);
      const page = queryPage(request);
      const result = await database.query(`select event.voucher_id,event.sequence,event.previous_state,event.next_state,event.reason,event.actor_id,event.occurred_at,
        event.voucher_id||':'||lpad(event.sequence::text,20,'0') cursor_id
        from voucher.statusevent event join voucher.voucher voucher on voucher.id=event.voucher_id join voucher.program program on program.id=voucher.program_id
        where access.scope_allowed(program.scope_id) and ($1::timestamptz is null or (event.occurred_at,event.voucher_id||':'||lpad(event.sequence::text,20,'0'))<
          ($1::timestamptz,$2)) order by event.occurred_at desc,event.voucher_id desc,event.sequence desc limit $3`, [page.sort, page.id, page.fetch]);
      return keysetResult(result, page, 'occurred_at', 'cursor_id');
    },
  };
}
