import type { ModuleContext } from '../../../../composition/ModuleRegistry';
import type { SqlExecutor } from '../../../../platform/database/PgTransactionAccess';
import type { OperationRequest, OperationResult } from '../../../../pipeline/OperationRequest';
import { requireAccess } from '../../../../pipeline/OperationAccess';
import { keysetResult, queryPage } from '../../../../pipeline/Validation';
import { MEMBER_ACCESS_PORT } from '../../../access/public';

export function benefitAccountReader(context: ModuleContext): (request: OperationRequest, database: SqlExecutor) => Promise<OperationResult> {
  const members = context.ports.get(MEMBER_ACCESS_PORT);
  return async (request, database) => {
    const access = requireAccess(request);
    const page = queryPage(request.input);
    const member = await members.member(database.transaction, access.membership.id);
    const result = await database.query(
      `select account.id,account.kind,account.currency,account.status,account.version,
      balance.balance_minor::float8 balance_minor,
      coalesce((select sum(reservation.amount_minor) from benefit.reservation reservation where reservation.account_id=account.id
        and reservation.state='active' and reservation.expires_at>clock_timestamp()),0)::float8 frozen_minor,
      greatest(0,least(balance.balance_minor,coalesce((select sum(lot.remaining_minor) from benefit.lot lot where lot.account_id=account.id
        and lot.state='active' and lot.effective_at<=clock_timestamp() and (lot.expires_at is null or lot.expires_at>clock_timestamp())),0))
        -coalesce((select sum(reservation.amount_minor) from benefit.reservation reservation
        where reservation.account_id=account.id and reservation.state='active' and reservation.expires_at>clock_timestamp()),0))::float8 available_minor,
      coalesce((select jsonb_agg(jsonb_build_object('id',lot.id,'batch',lot.batch_id,'totalMinor',lot.total_minor,
        'remainingMinor',lot.remaining_minor,'state',lot.state,
        'effectiveAt',to_char(lot.effective_at at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),
        'expiresAt',case when lot.expires_at is null then null else
          to_char(lot.expires_at at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') end)
        order by lot.effective_at,lot.expires_at nulls last,lot.id) from benefit.lot lot where lot.account_id=account.id
        and lot.state in('pending','active')),'[]'::jsonb) lots
      from benefit.account account join benefit.balance balance on balance.account_id=account.id
      where account.member_id=$1 and ($2::text is null or (account.kind,account.id)>($2,$3))
      order by account.kind,account.id limit $4`,
      [member, page.sort, page.id, page.fetch]
    );
    return keysetResult(result, page, 'kind');
  };
}
