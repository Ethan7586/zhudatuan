import type { OperationActions } from '../../../../foundation/application/ModuleOperations';
import { requireAccess } from '../../../../foundation/application/ModuleOperations';
import { keysetResult, queryPage } from '../../../../foundation/interface/Validation';

export function getInvoicesOperations(): OperationActions {
  return {
    'invoice.profiles.read': async (request, database) => {
      const access = requireAccess(request); const page = queryPage(request);
      const result = await database.query(`select profile.id,profile.status,profile.version from access.membership membership
        join invoice.profile profile on profile.owner_id=membership.member_id where membership.id=$1 and profile.status='active'
        and ($2::text is null or profile.id>$2) order by profile.id limit $3`, [access.membership.id, page.id, page.fetch]);
      return keysetResult(result, page, 'id');
    },
    'invoice.requests.read': async (request, database) => {
      const access = requireAccess(request); const page = queryPage(request);
      const result = await database.query(`select request.*,document.object_ref,document.sha256,document.issued_at,
        coalesce((select jsonb_agg(jsonb_build_object('settlementLine',line.settlement_line_id,'amountMinor',line.amount_minor,
          'taxMinor',line.tax_minor,'sourceHash',line.source_hash) order by line.settlement_line_id)
          from invoice.requestline line where line.request_id=request.id),'[]'::jsonb) lines from invoice.request request
        join invoice.profile profile on profile.id=request.profile_id left join invoice.document document on document.request_id=request.id
        where profile.owner_id=$1 and ($2::timestamptz is null or (request.created_at,request.id)<($2::timestamptz,$3))
        order by request.created_at desc,request.id desc limit $4`, [access.scope.id, page.sort, page.id, page.fetch]);
      return keysetResult(result, page, 'created_at');
    },
  };
}
