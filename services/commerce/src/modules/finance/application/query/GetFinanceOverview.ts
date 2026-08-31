import type { OperationActions } from '../../../../foundation/application/ModuleOperations';
import { requireAccess } from '../../../../foundation/application/ModuleOperations';
import { organizationScope } from '../../../../foundation/security/OrganizationScope';
import type { OrganizationReadPort } from '../../../organization/public';

export function getFinanceOverviewOperations(organization: OrganizationReadPort): OperationActions {
  return {
    'finance.overview.read': async (request, database) => {
      const access = requireAccess(request);
      const scopes = await organization.descendants(database, organizationScope(access.scope));
      const result = await database.query(
        `with balance as(select account.currency,account.kind,account.code,
          coalesce(sum(case when account.kind in('liability','income') then case entry.side when 'credit' then entry.amount_minor
            else -entry.amount_minor end else case entry.side when 'debit' then entry.amount_minor else -entry.amount_minor end end),0) amount,
          count(distinct journal.id) journal_count,max(journal.posted_at) watermark from finance.account account
          left join finance.entry entry on entry.account_id=account.id left join finance.journal journal on journal.id=entry.journal_id
            and journal.state='posted' where account.scope_id=any($1::text[])
          group by account.id)
        select currency,coalesce(sum(amount) filter(where kind='asset'),0)::float8 balance_minor,
          coalesce(sum(amount) filter(where kind='liability'),0)::float8 liability_minor,
          coalesce(sum(amount) filter(where kind='income'),0)::float8 income_minor,
          coalesce(sum(amount) filter(where kind='expense'),0)::float8 expense_minor,
          coalesce(sum(amount) filter(where code='cash'),0)::float8 cash_minor,sum(journal_count)::integer journal_count,max(watermark) watermark
        from balance group by currency order by currency`,
        [scopes]
      );
      return { status: 200, body: { items: result.rows } };
    },
  };
}
