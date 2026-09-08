import { rowResult } from '../../../../platform/database/DatabaseResult';
import { requireAccess } from '../../../../pipeline/OperationAccess';
import { bodyRecord, keysetResult, queryPage, textField } from '../../../../pipeline/Validation';
import type { FinanceScopeQuery } from './FinanceScopeQuery';
import type { FinanceEntries } from './FinanceOperation';

export function backfillActions(scopes: FinanceScopeQuery): FinanceEntries<'backfillsRead' | 'backfillsDecide'> {
  return {
    backfillsRead: async (request, database) => {
      const access = requireAccess(request);
      const page = queryPage(request.input);
      const allowed = await scopes.descendants(database, access.scope);
      const result = await database.query(
        `select id,scope_id,source_hash,target_hash,source_count,target_count,source_minor,target_minor,
        state,prepared_by,signed_by,evidence,prepared_at,signed_at from finance.backfill where access.scope_allowed(scope_id)
        and scope_id=any($1::text[])
        and ($2::timestamptz is null or (prepared_at,id)<($2::timestamptz,$3)) order by prepared_at desc,id desc limit $4`,
        [allowed, page.sort, page.id, page.fetch]
      );
      return keysetResult(result, page, 'prepared_at');
    },
    backfillsDecide: async (request, database) => {
      const access = requireAccess(request);
      const body = bodyRecord(request.input);
      const decision = body.decision === 'approved' ? 'approved' : body.decision === 'rejected' ? 'rejected' : null;
      if (!decision) throw new Error('FINANCE_BACKFILL_DECISION_INVALID');
      const result = await database.query(
        `update finance.backfill set state=$2,signed_by=$3,signed_at=clock_timestamp(),
        evidence=evidence||$4::jsonb where id=$1 and state='pending' and prepared_by<>$3 and source_hash=target_hash
        and source_count=target_count and source_minor=target_minor returning *`,
        [request.input.path.backfillid!, decision, access.actor.id, JSON.stringify({ reason: textField(body, 'reason', 1000), evidence: body.evidence ?? {} })]
      );
      if (!result.rows[0]) throw new Error('FINANCE_BACKFILL_CONFLICT_OR_MISMATCH');
      return rowResult(result);
    },
  };
}
