import type { VoucherPersistence } from './VoucherAction';
import { requireAccess } from '../../../../foundation/application/OperationAccess';

import { keysetResult, queryPage } from '../../../../foundation/interface/Validation';
import { organizationScope } from '../../../../foundation/security/OrganizationScope';
import type { OrganizationReadPort } from '../../../organization/public';

export function voucherQueryPersistence(organizations: Pick<OrganizationReadPort, 'descendants'>): Pick<VoucherPersistence, 'readStatusBatches' | 'readBindings' | 'readRedemptions' | 'readHistory'> {
  return {
    readStatusBatches: async (request, database) => {
      requireAccess(request);
      const page = queryPage(request.input);
      const batch = request.input.query.batch;
      if (typeof batch === 'string' && batch.length > 0) {
        const result = await database.query(
          `select item.batch_id,item.voucher_id,item.state,item.previous_state,item.next_state,item.error_code,item.updated_at
          from voucher.statusitem item join voucher.statusbatch batch on batch.id=item.batch_id where item.batch_id=$1 and access.scope_allowed(batch.scope_id)
          and ($2::text is null or item.voucher_id>$2) order by item.voucher_id limit $3`,
          [batch, page.id, page.fetch]
        );
        return keysetResult(result, page, 'voucher_id');
      }
      const result = await database.query(
        `select id,action,expires_at,reason,actor_id,state,requested_count,succeeded_count,failed_count,created_at,updated_at
        from voucher.statusbatch where access.scope_allowed(scope_id) and ($1::timestamptz is null or (created_at,id)<($1::timestamptz,$2))
        order by created_at desc,id desc limit $3`,
        [page.sort, page.id, page.fetch]
      );
      return keysetResult(result, page, 'created_at');
    },
    readBindings: async (request, database) => {
      const access = requireAccess(request);
      const page = queryPage(request.input);
      const personal = access.scope.kind === 'owner';
      const visibleScopes = personal ? [] : await organizations.descendants(database.transaction, organizationScope(access.scope));
      const result = await database.query(
        `select voucher.id,voucher.program_id,program.name,voucher.member_id,voucher.initial_minor,voucher.remaining_minor,voucher.state,voucher.expires_at,voucher.version,
        coalesce(voucher.expires_at,'infinity') cursor_sort
        from voucher.voucher voucher join voucher.program program on program.id=voucher.program_id where
          (($4 and voucher.member_id=$1) or (not $4 and program.scope_id=any($5::text[])))
          and ($2::timestamptz is null or (coalesce(voucher.expires_at,'infinity'),voucher.id)>($2::timestamptz,$3))
        order by coalesce(voucher.expires_at,'infinity'),voucher.id limit $6`,
        [access.scope.id, page.sort, page.id, personal, visibleScopes, page.fetch]
      );
      return keysetResult(result, page, 'cursor_sort');
    },
    readRedemptions: async (request, database) => {
      const access = requireAccess(request);
      const page = queryPage(request.input);
      const personal = access.scope.kind === 'owner';
      const result = await database.query(
        `select redemption.id,redemption.voucher_id,redemption.verification_id,redemption.order_id,
        redemption.amount_minor,redemption.redeemed_at,redemption.reversed_at,redemption.version,voucher.program_id,
        coalesce(reversal.amount_minor,0)::float8 reversed_minor,
        case when coalesce(reversal.amount_minor,0)=0 then 'redeemed'
          when reversal.amount_minor<redemption.amount_minor then 'partially_reversed' else 'reversed' end receipt_state,
        reversal.last_reversed_at
        from voucher.redemption redemption join voucher.voucher voucher on voucher.id=redemption.voucher_id
        join voucher.program program on program.id=voucher.program_id
        left join lateral(select sum(amount_minor) amount_minor,max(occurred_at) last_reversed_at from voucher.reversal
          where redemption_id=redemption.id and state='reversed') reversal on true
        where (($4 and voucher.member_id=$3) or (not $4 and access.scope_allowed(program.scope_id)))
        and ($1::timestamptz is null or (redemption.redeemed_at,redemption.id)<($1::timestamptz,$2))
        order by redemption.redeemed_at desc,redemption.id desc limit $5`,
        [page.sort, page.id, access.scope.id, personal, page.fetch]
      );
      return keysetResult(result, page, 'redeemed_at');
    },
    readHistory: async (request, database) => {
      requireAccess(request);
      const page = queryPage(request.input);
      const result = await database.query(
        `select event.voucher_id,event.sequence,event.previous_state,event.next_state,event.reason,event.actor_id,event.occurred_at,
        event.voucher_id||':'||lpad(event.sequence::text,20,'0') cursor_id
        from voucher.statusevent event join voucher.voucher voucher on voucher.id=event.voucher_id join voucher.program program on program.id=voucher.program_id
        where access.scope_allowed(program.scope_id) and ($1::timestamptz is null or (event.occurred_at,event.voucher_id||':'||lpad(event.sequence::text,20,'0'))<
          ($1::timestamptz,$2)) order by event.occurred_at desc,event.voucher_id desc,event.sequence desc limit $3`,
        [page.sort, page.id, page.fetch]
      );
      return keysetResult(result, page, 'occurred_at', 'cursor_id');
    },
  };
}
