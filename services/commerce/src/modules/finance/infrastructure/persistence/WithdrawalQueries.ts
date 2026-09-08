import { requireAccess } from '../../../../pipeline/OperationAccess';
import { keysetResult, queryPage } from '../../../../pipeline/Validation';
import type { FinanceScopeQuery } from './FinanceScopeQuery';
import type { FinanceEntries } from './FinanceOperation';

export function withdrawalQueries(scopes: FinanceScopeQuery): FinanceEntries<'withdrawalsRead'> {
  return {
    withdrawalsRead: async (request, database) => {
      const access = requireAccess(request);
      const page = queryPage(request.input);
      const allowed = await scopes.descendants(database, access.scope);
      const result = await database.query(
        `select withdrawal.id,withdrawal.scope_id,withdrawal.settlement_id,withdrawal.amount_minor,
        withdrawal.currency,withdrawal.destination_ref,withdrawal.state,withdrawal.requested_by,withdrawal.approved_by,
        withdrawal.reason,withdrawal.evidence,withdrawal.provider_reference,withdrawal.provider,withdrawal.provider_state,
        withdrawal.request_hash,withdrawal.input_watermark,withdrawal.response_hash,withdrawal.created_at,withdrawal.updated_at,
        withdrawal.paid_at,withdrawal.version from finance.withdrawal withdrawal where access.scope_allowed(withdrawal.scope_id)
        and withdrawal.scope_id=any($1::text[])
        and ($2::timestamptz is null or (withdrawal.created_at,withdrawal.id)<($2::timestamptz,$3))
        order by withdrawal.created_at desc,withdrawal.id desc limit $4`,
        [allowed, page.sort, page.id, page.fetch]
      );
      return keysetResult(result, page, 'created_at');
    },
  };
}
