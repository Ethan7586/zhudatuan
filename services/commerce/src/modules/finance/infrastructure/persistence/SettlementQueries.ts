import { requireAccess } from '../../../../pipeline/OperationAccess';
import { keysetResult, queryPage } from '../../../../pipeline/Validation';
import type { FinanceScopeQuery } from './FinanceScopeQuery';
import type { FinanceEntries } from './FinanceOperation';

export function settlementQueries(scopes: FinanceScopeQuery): FinanceEntries<'settlementsRead'> {
  return {
    settlementsRead: async (request, database) => {
      const access = requireAccess(request);
      const page = queryPage(request.input);
      const allowed = await scopes.descendants(database, access.scope);
      const result = await database.query(
        `select settlement.id,settlement.partner_id,settlement.period,settlement.reconciliation_id,
        settlement.amount_minor,settlement.currency,settlement.state,settlement.scope_id,settlement.requested_by,settlement.approved_by,
        settlement.frozen_at,settlement.approved_at,settlement.paid_at,settlement.evidence,settlement.version,
        settlement.gross_minor,settlement.fee_minor,settlement.invoice_basis,settlement.input_hash,
        settlement.input_count,settlement.input_minor,settlement.input_watermark,
        coalesce((select jsonb_agg(jsonb_build_object('id',line.id,'sourceType',line.source_type,'sourceId',line.source_id,
          'amountMinor',line.amount_minor,'taxMinor',line.tax_minor,'state',line.state,'adjustmentOf',line.adjustment_of) order by line.id)
          from finance.settlementline line where line.settlement_id=settlement.id),'[]'::jsonb) lines,
        coalesce((select jsonb_agg(jsonb_build_object('id',split.id,'beneficiaryType',split.beneficiary_type,
          'beneficiaryId',split.beneficiary_id,'amountMinor',split.amount_minor,'basisPoints',split.basis_points,'state',split.state) order by split.id)
          from finance.split split where split.settlement_id=settlement.id),'[]'::jsonb) splits,
        coalesce((select jsonb_agg(jsonb_build_object('id',adjustment.id,'line',adjustment.settlement_line_id,
          'direction',adjustment.direction,'amountMinor',adjustment.amount_minor,'taxMinor',adjustment.tax_minor,'state',adjustment.state,
          'requestedBy',adjustment.requested_by,'approvedBy',adjustment.approved_by,'reason',adjustment.reason,'evidence',adjustment.evidence)
          order by adjustment.created_at,adjustment.id) from finance.settlementadjustment adjustment
          where adjustment.settlement_id=settlement.id),'[]'::jsonb) adjustments
        from finance.settlement settlement where access.scope_allowed(settlement.scope_id)
        and settlement.scope_id=any($1::text[])
        and ($2::text is null or settlement.id>$2) order by settlement.id limit $3`,
        [allowed, page.id, page.fetch]
      );
      return keysetResult(result, page, 'id');
    },
  };
}
