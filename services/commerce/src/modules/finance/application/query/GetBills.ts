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
<<<<<<< HEAD
      const result = await database.query(`select statement.*,
        coalesce((select jsonb_agg(jsonb_build_object(
          'accountId',line.account_id,'accountCode',line.account_code,'accountKind',line.account_kind,
          'openingDebitMinor',line.opening_debit_minor::text,'openingCreditMinor',line.opening_credit_minor::text,
          'periodDebitMinor',line.period_debit_minor::text,'periodCreditMinor',line.period_credit_minor::text,
          'closingDebitMinor',line.closing_debit_minor::text,'closingCreditMinor',line.closing_credit_minor::text,
          'sourceHash',line.source_hash
        ) order by line.account_code,line.account_id)
        from finance.statementaccount line where line.statement_id=statement.id),'[]'::jsonb) accounts
        from finance.statement statement where statement.scope_id in(
          select descendant_id from organization.unitclosure where ancestor_id=$1)
        and statement.state in('draft','final') and statement.calculation_version=2 and statement.balanced
        and ($2::date is null or (statement.period_end,statement.id)<($2::date,$3))
        order by statement.period_end desc,statement.id desc limit $4`,
=======
      const result = await database.query(`select * from finance.statement where scope_id in(
          select descendant_id from organization.unitclosure where ancestor_id=$1) and state in('draft','final')
        and ($2::date is null or (period_end,id)<($2::date,$3)) order by period_end desc,id desc limit $4`,
>>>>>>> a7d9b2c8 (chore: establish zhudatuan main platform baseline)
      [access.scope.id, page.sort, page.id, page.fetch]);
      return keysetResult(result, page, 'period_end');
    },
    'finance.statements.export': async (request, database) => {
      return { status: 202, body: await createReportingExport(request, database, 'finance.statement', bodyRecord(request)) };
    },
  };
}
