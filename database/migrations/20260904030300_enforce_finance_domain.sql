begin;

do $precondition$
begin
  if not exists(select 1 from runtime.schemaversion where version='20260904030200') then raise exception 'FINANCE_DOMAIN_PREVIOUS_HEAD_MISSING'; end if;
  if exists(select 1 from runtime.schemaversion where version='20260904030300') then raise exception 'FINANCE_DOMAIN_ALREADY_APPLIED'; end if;
end
$precondition$;

create temporary table finance_domain_before on commit drop as
select (select count(*) from finance.account)::bigint accounts,
  (select count(*) from finance.journal)::bigint journals,
  (select count(*) from finance.entry)::bigint entries,
  (select coalesce(sum(amount_minor),0) from finance.entry)::numeric entry_minor;

alter table finance.account add constraint finance_account_code_shape
  check(length(code) between 1 and 192 and code~'^[a-z][a-z0-9]*([.:][a-z0-9]+(-[a-z0-9]+)*)*$') not valid;
alter table finance.account add constraint finance_account_currency_supported check(currency='CNY') not valid;
alter table finance.journal add constraint finance_journal_reference_shape
  check(length(reference_type) between 1 and 128 and reference_type~'^[a-z][a-z0-9]*(\.[a-z][a-z0-9]*)*$'
    and length(reference_id) between 1 and 256 and reference_id!~'[[:cntrl:]]') not valid;
alter table finance.journal add constraint finance_journal_currency_supported check(currency='CNY') not valid;
alter table finance.statement add constraint finance_statement_currency_supported check(currency='CNY') not valid;
alter table finance.statement add constraint finance_statement_conservation
  check(opening_minor+debit_minor-credit_minor=closing_minor) not valid;
alter table finance.settlement add constraint finance_settlement_currency_supported check(currency='CNY') not valid;
alter table finance.withdrawal add constraint finance_withdrawal_currency_supported check(currency='CNY') not valid;
alter table invoice.request add constraint invoice_request_currency_supported check(currency='CNY') not valid;

create or replace function finance.ensure_account(p_scope text,p_code text,p_currency text,p_kind text)
returns text language plpgsql volatile security definer set search_path=finance,pg_temp as $function$
declare accountid text;
begin
  if p_scope is null or p_scope='' or p_code is null or length(p_code) not between 1 and 192
    or p_code!~'^[a-z][a-z0-9]*([.:][a-z0-9]+(-[a-z0-9]+)*)*$'
    or p_currency is null or p_currency<>'CNY' or p_kind is null or p_kind not in('asset','liability','equity','income','expense') then
    raise exception 'FINANCE_ACCOUNT_CONTRACT_INVALID';
  end if;
  accountid:=finance.account_id(p_scope,p_code,p_currency);
  insert into finance.account(id,scope_id,code,currency,kind,status) values(accountid,p_scope,p_code,p_currency,p_kind,'active')
    on conflict(scope_id,code,currency) do update set status='active'
    where finance.account.kind=excluded.kind;
  if not exists(select 1 from finance.account where id=accountid and scope_id=p_scope and code=p_code and currency=p_currency and kind=p_kind)
    then raise exception 'FINANCE_ACCOUNT_CONTRACT_MISMATCH'; end if;
  return accountid;
end
$function$;
revoke all on function finance.ensure_account(text,text,text,text) from public;
grant execute on function finance.ensure_account(text,text,text,text) to shopapp,shopjob;

select runtime.record_migration_evidence('20260904030300',before.rows_count,after.rows_count,before.minor,after.minor,
  'select conname,convalidated from pg_constraint where conname like ''finance_%_supported'' or conname in(''finance_account_code_shape'',''finance_journal_reference_shape'',''finance_statement_conservation'') order by conname;',
  'select journal.id from finance.journal journal join finance.entry entry on entry.journal_id=journal.id where journal.state=''posted'' group by journal.id having sum(case entry.side when ''debit'' then entry.amount_minor else -entry.amount_minor end)<>0;')
from (select accounts+journals+entries rows_count,entry_minor minor from finance_domain_before) before
cross join (select (select count(*) from finance.account)+(select count(*) from finance.journal)+(select count(*) from finance.entry) rows_count,
  (select coalesce(sum(amount_minor),0) from finance.entry) minor) after;

insert into runtime.schemaversion(version,checksum)
values('20260904030300',encode(public.digest('20260904030300_enforce_finance_domain','sha256'),'hex'));

do $assert$
begin
  if (select count(*) from pg_constraint where conname in(
    'finance_account_code_shape','finance_account_currency_supported','finance_journal_reference_shape','finance_journal_currency_supported',
    'finance_statement_currency_supported','finance_statement_conservation','finance_settlement_currency_supported',
    'finance_withdrawal_currency_supported','invoice_request_currency_supported'))<>9 then
    raise exception 'FINANCE_DOMAIN_CONSTRAINTS_MISSING';
  end if;
  if not has_function_privilege('shopapp','finance.ensure_account(text,text,text,text)','EXECUTE')
    or not has_function_privilege('shopjob','finance.ensure_account(text,text,text,text)','EXECUTE')
    or has_function_privilege('public','finance.ensure_account(text,text,text,text)','EXECUTE') then
    raise exception 'FINANCE_ACCOUNT_FUNCTION_PRIVILEGE_INVALID';
  end if;
end
$assert$;

commit;
