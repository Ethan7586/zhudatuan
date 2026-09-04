begin;

do $precondition$
begin
  if not exists(select 1 from runtime.schemaversion where version='20260904054000') then raise exception 'IDEAL_FINANCE_ASSERT_PREVIOUS_HEAD_MISSING'; end if;
  if exists(select 1 from runtime.schemaversion where version='20260904055000') then raise exception 'IDEAL_FINANCE_ASSERT_ALREADY_APPLIED'; end if;
end
$precondition$;

do $assert$
begin
  if exists(select journal.id from finance.journal journal join finance.entry entry on entry.journal_id=journal.id
    where journal.state='posted' group by journal.id
    having sum(case entry.side when 'debit' then entry.amount_minor else -entry.amount_minor end)<>0)
  then raise exception 'IDEAL_FINANCE_JOURNAL_UNBALANCED'; end if;
  if exists(select 1 from finance.entry entry join finance.journal journal on journal.id=entry.journal_id
    join finance.account account on account.id=entry.account_id where account.currency<>journal.currency)
  then raise exception 'IDEAL_FINANCE_CURRENCY_MISMATCH'; end if;
  if exists(select source_kind,source_id,economic_leg from finance.postingreference
    group by source_kind,source_id,economic_leg having count(*)>1)
  then raise exception 'IDEAL_FINANCE_POSTING_DUPLICATE'; end if;
  if exists(select 1 from finance.journal journal join finance.period period
    on period.scope_id=journal.scope_id and period.period=journal.period where period.state='closed' and journal.state='draft')
  then raise exception 'IDEAL_FINANCE_CLOSED_PERIOD_PENDING'; end if;
  if exists(select 1 from finance.economicleg leg join finance.postingreference reference on reference.journal_id=leg.journal_id
    where leg.amount_minor<>reference.amount_minor or leg.currency<>reference.currency)
  then raise exception 'IDEAL_FINANCE_HISTORICAL_AMOUNT_MISMATCH'; end if;
end
$assert$;

select runtime.record_migration_evidence('20260904055000',
  (select count(*) from finance.economicleg),(select count(*) from finance.postingreference),
  (select coalesce(sum(amount_minor),0) from finance.economicleg),(select coalesce(sum(amount_minor),0) from finance.postingreference),
  'select currency,state,count(*) from finance.journal group by currency,state;',
  'select reference_type,reference_id,count(*) from finance.journal group by reference_type,reference_id having count(*)>1;');
insert into runtime.schemaversion(version,checksum)
values('20260904055000',encode(public.digest('20260904055000_assert_finance_ledger','sha256'),'hex'));

commit;
