import type { OperationActions } from '../../../../foundation/application/ModuleOperations';
import { requireAccess } from '../../../../foundation/application/ModuleOperations';
import { requestProjectionExport } from '../../../../foundation/application/RequestExport';
import { organizationScope } from '../../../../foundation/security/OrganizationScope';
import { bodyRecord, keysetResult, queryPage } from '../../../../foundation/interface/Validation';
import type { OrganizationReadPort } from '../../../organization/public';

export function getBillsOperations(organization: OrganizationReadPort): OperationActions {
  return {
    'finance.entries.read': async (request, database) => {
      const access = requireAccess(request);
      const page = queryPage(request);
      const scopes = await organization.descendants(database, organizationScope(access.scope));
      const result = await database.query(
        `select entry.id,entry.side,entry.amount_minor,account.code,account.currency,
        journal.reference_type,journal.reference_id,journal.description,journal.posted_at from finance.entry entry
        join finance.account account on account.id=entry.account_id join finance.journal journal on journal.id=entry.journal_id
        where account.scope_id=any($1::text[]) and journal.state='posted'
        and ($2::timestamptz is null or (journal.posted_at,entry.id)<($2::timestamptz,$3))
        order by journal.posted_at desc,entry.id desc limit $4`,
        [scopes, page.sort, page.id, page.fetch]
      );
      return keysetResult(result, page, 'posted_at');
    },
    'finance.statements.read': async (request, database) => {
      const access = requireAccess(request);
      const page = queryPage(request);
      const scopes = await organization.descendants(database, organizationScope(access.scope));
      const result = await database.query(
        `select id,scope_id,period_start,period_end,currency,opening_minor,debit_minor,credit_minor,
        closing_minor,state,object_ref,sha256,generated_at from finance.statement where scope_id=any($1::text[]) and state in('draft','final')
        and ($2::date is null or (period_end,id)<($2::date,$3)) order by period_end desc,id desc limit $4`,
        [scopes, page.sort, page.id, page.fetch]
      );
      return keysetResult(result, page, 'period_end');
    },
    'finance.statements.export': async (request, database) => {
      return { status: 202, body: await requestProjectionExport(request, database, 'finance.statement', bodyRecord(request)) };
    },
  };
}
