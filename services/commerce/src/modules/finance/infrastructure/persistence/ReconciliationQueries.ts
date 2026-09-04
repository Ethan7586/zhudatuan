import { requireAccess } from '../../../../foundation/application/OperationAccess';
import { keysetResult, queryPage } from '../../../../foundation/application/Validation';
import type { FinanceScopeQuery } from './FinanceScopeQuery';
import type { FinanceEntries } from './FinanceOperation';

export function reconciliationQueries(scopes: FinanceScopeQuery): FinanceEntries<'reconciliationsRead'> {
  return {
    reconciliationsRead: async (request, database) => {
      const access = requireAccess(request);
      const page = queryPage(request.input);
      const query = request.input.query;
      const allowed = await scopes.descendants(database, access.scope);
      const result = await database.query(
        `select reconciliation.id,reconciliation.scope_id,reconciliation.provider,
        reconciliation.partner_id,reconciliation.period,reconciliation.statement_ref,reconciliation.statement_hash,
        reconciliation.state,reconciliation.debit_minor,reconciliation.credit_minor,reconciliation.difference_minor,
        reconciliation.created_by,reconciliation.approved_by,reconciliation.evidence,reconciliation.updated_at,reconciliation.version,
        coalesce((select jsonb_object_agg(state,count) from (select state,count(*) count from finance.reconciliationitem item
          where item.reconciliation_id=reconciliation.id group by state) states),'{}'::jsonb) item_counts,
        coalesce((select jsonb_agg(jsonb_build_object('id',item.id,'externalMinor',item.external_minor,'internalMinor',item.internal_minor,
          'differenceMinor',item.difference_minor,'state',item.state,'reasonCode',item.reason_code,'evidence',item.evidence,
          'resolution',item.resolution,'resolvedBy',item.resolved_by,'approvedBy',item.approved_by) order by item.id)
          from finance.reconciliationitem item where item.reconciliation_id=reconciliation.id),'[]'::jsonb) items
        from finance.reconciliation reconciliation where access.scope_allowed(reconciliation.scope_id)
        and reconciliation.scope_id=any($1::text[])
        and ($2::text is null or reconciliation.period=$2)
        and ($3::text is null or reconciliation.provider=$3)
        and ($4::text is null or reconciliation.scope_id=$4)
        and ($5::text is null or reconciliation.state=$5)
        and ($6::text is null or exists(select 1 from finance.reconciliationitem filtered
          where filtered.reconciliation_id=reconciliation.id and filtered.reason_code=$6))
        and ($7::text is null or reconciliation.id>$7) order by reconciliation.id limit $8`,
        [allowed, query.period ?? null, query.provider ?? null, query.mall ?? null, query.state ?? null, query.differenceType ?? null, page.id, page.fetch]
      );
      return keysetResult(result, page, 'id');
    },
  };
}
