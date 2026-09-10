begin;

do $precondition$
begin
  if not exists(select 1 from runtime.schemaversion where version='20260904052000') then raise exception 'IDEAL_FINANCE_PREVIOUS_HEAD_MISSING'; end if;
  if exists(select 1 from runtime.schemaversion where version='20260904053000') then raise exception 'IDEAL_FINANCE_ALREADY_APPLIED'; end if;
  if (select count(*) from information_schema.tables where table_schema in('finance','invoice') and table_name in(
    'account','journal','entry','period','statement','reconciliation','repair','settlement','request','document'))<>10
  then raise exception 'IDEAL_FINANCE_TABLES_MISSING'; end if;
end
$precondition$;

create table finance.postingreference(
  tenant_id text not null,
  scope_id text not null,
  source_kind text not null check(source_kind~'^[a-z][a-z0-9.]{1,127}$'),
  source_id text not null,
  economic_leg text not null,
  journal_id text not null unique references finance.journal(id),
  currency char(3) not null check(currency='CNY'),
  amount_minor bigint not null check(amount_minor>0),
  source_hash char(64) not null check(source_hash~'^[0-9a-f]{64}$'),
  posted_by text not null,
  posted_at timestamptz not null,
  version bigint not null check(version>0),
  primary key(source_kind,source_id,economic_leg)
);
alter table finance.postingreference enable row level security;
alter table finance.postingreference force row level security;
create policy migrationaccess on finance.postingreference for all to shopmigration using(true) with check(true);
create policy postingreferenceapp on finance.postingreference for select to shopapp using(access.scope_allowed(scope_id));
create policy postingreferencejob on finance.postingreference for all to shopjob using(true) with check(true);
revoke all on finance.postingreference from public;
grant select on finance.postingreference to shopapp;
grant select,insert on finance.postingreference to shopjob;
create trigger finance_postingreference_immutable before update or delete on finance.postingreference
  for each row execute function finance.reject_ledger_mutation();

select runtime.record_migration_evidence('20260904053000',
  (select count(*) from finance.journal),(select count(*) from finance.journal),
  (select coalesce(sum(amount_minor),0) from finance.entry),(select coalesce(sum(amount_minor),0) from finance.entry),
  'select state,currency,count(*) from finance.journal group by state,currency;',
  'select journal_id,sum(case side when ''debit'' then amount_minor else -amount_minor end) balance from finance.entry group by journal_id;');
insert into runtime.schemaversion(version,checksum)
values('20260904053000',encode(public.digest('20260904053000_prepare_finance_ledger','sha256'),'hex'));

commit;
