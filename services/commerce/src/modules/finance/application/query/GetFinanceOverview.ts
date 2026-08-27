import type { OperationActions } from '../../../../foundation/application/ModuleOperations';
import { requireAccess } from '../../../../foundation/application/ModuleOperations';

export function getFinanceOverviewOperations(): OperationActions {
  return {
    'finance.overview.read': async (request, database) => {
      const access = requireAccess(request);
<<<<<<< HEAD
      const result = await database.query(
        `with posted_entry as(
          select entry.account_id,entry.side,entry.amount_minor,journal.id journal_id,journal.posted_at
          from finance.entry entry join finance.journal journal on journal.id=entry.journal_id and journal.state='posted'
        ),balance as(select account.currency,account.kind,account.code,
          coalesce(sum(case when account.kind in('liability','income') then case entry.side when 'credit' then entry.amount_minor
            else -entry.amount_minor end else case entry.side when 'debit' then entry.amount_minor else -entry.amount_minor end end),0) amount
          from finance.account account
          left join posted_entry entry on entry.account_id=account.id
          where account.scope_id in(select descendant_id from organization.unitclosure where ancestor_id=$1)
          group by account.id),journal_summary as(
          select account.currency,count(distinct entry.journal_id)::integer journal_count,max(entry.posted_at) watermark
          from finance.account account left join posted_entry entry on entry.account_id=account.id
          where account.scope_id in(select descendant_id from organization.unitclosure where ancestor_id=$1)
          group by account.currency)
        select balance.currency,coalesce(sum(balance.amount) filter(where balance.kind='asset'),0)::text balance_minor,
          coalesce(sum(balance.amount) filter(where balance.kind='liability'),0)::text liability_minor,
          coalesce(sum(balance.amount) filter(where balance.kind='income'),0)::text income_minor,
          coalesce(sum(balance.amount) filter(where balance.kind='expense'),0)::text expense_minor,
          coalesce(sum(balance.amount) filter(where balance.code='cash'),0)::text cash_minor,
          summary.journal_count,summary.watermark from balance join journal_summary summary using(currency)
        group by balance.currency,summary.journal_count,summary.watermark order by balance.currency`,
        [access.scope.id]
      );
=======
      const result = await database.query(`with balance as(select account.currency,account.kind,account.code,
          coalesce(sum(case when account.kind in('liability','income') then case entry.side when 'credit' then entry.amount_minor
            else -entry.amount_minor end else case entry.side when 'debit' then entry.amount_minor else -entry.amount_minor end end),0) amount,
          count(distinct journal.id) journal_count,max(journal.posted_at) watermark from finance.account account
          left join finance.entry entry on entry.account_id=account.id left join finance.journal journal on journal.id=entry.journal_id
            and journal.state='posted' where account.scope_id in(select descendant_id from organization.unitclosure where ancestor_id=$1)
          group by account.id)
        select currency,coalesce(sum(amount) filter(where kind='asset'),0)::float8 balance_minor,
          coalesce(sum(amount) filter(where kind='liability'),0)::float8 liability_minor,
          coalesce(sum(amount) filter(where kind='income'),0)::float8 income_minor,
          coalesce(sum(amount) filter(where kind='expense'),0)::float8 expense_minor,
          coalesce(sum(amount) filter(where code='cash'),0)::float8 cash_minor,sum(journal_count)::integer journal_count,max(watermark) watermark
        from balance group by currency order by currency`, [access.scope.id]);
>>>>>>> a7d9b2c8 (chore: establish zhudatuan main platform baseline)
      return { status: 200, body: { items: result.rows } };
    },
  };
}
