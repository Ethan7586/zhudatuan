import type { OperationActions } from '../../../../foundation/application/ModuleOperations';
import { requireAccess } from '../../../../foundation/application/ModuleOperations';
import { bodyRecord, keysetResult, queryPage } from '../../../../foundation/interface/Validation';
import { createReportingExport } from '../../../reporting/ReportingModule';

export function getBillsOperations(): OperationActions {
  return {
    'finance.entries.read': async (request, database) => {
      const access = requireAccess(request); const page = queryPage(request);
      const result = await database.query(`select entry.id,entry.side,entry.amount_minor,account.code,account.currency,
        journal.reference_type,journal.reference_id,journal.description,journal.posted_at from finance.entry entry
        join finance.account account on account.id=entry.account_id join finance.journal journal on journal.id=entry.journal_id
        where account.scope_id in(select descendant_id from organization.unitclosure where ancestor_id=$1) and journal.state='posted'
        and ($2::timestamptz is null or (journal.posted_at,entry.id)<($2::timestamptz,$3))
        order by journal.posted_at desc,entry.id desc limit $4`, [access.scope.id, page.sort, page.id, page.fetch]);
      return keysetResult(result, page, 'posted_at');
    },
    'finance.statements.read': async (request, database) => {
      const access = requireAccess(request); const page = queryPage(request);
      const result = await database.query(`select * from finance.statement where scope_id in(
          select descendant_id from organization.unitclosure where ancestor_id=$1) and state in('draft','final')
        and ($2::date is null or (period_end,id)<($2::date,$3)) order by period_end desc,id desc limit $4`,
      [access.scope.id, page.sort, page.id, page.fetch]);
      return keysetResult(result, page, 'period_end');
    },
    'finance.statements.export': async (request, database) => {
      return { status: 202, body: await createReportingExport(request, database, 'finance.statement', bodyRecord(request)) };
    },
  };
}
