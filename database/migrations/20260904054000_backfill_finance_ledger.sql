begin;

do $precondition$
begin
  if not exists(select 1 from runtime.schemaversion where version='20260904053000') then raise exception 'IDEAL_FINANCE_BACKFILL_PREVIOUS_HEAD_MISSING'; end if;
  if exists(select 1 from runtime.schemaversion where version='20260904054000') then raise exception 'IDEAL_FINANCE_BACKFILL_ALREADY_APPLIED'; end if;
end
$precondition$;

do $policy$
begin
  if not exists(
    select 1 from pg_policies
    where schemaname='finance' and tablename='postingreference' and policyname='migrationaccess'
  ) then
    execute 'create policy migrationaccess on finance.postingreference for all to shopmigration using(true) with check(true)';
  end if;
end
$policy$;

insert into finance.postingreference(
  tenant_id,scope_id,source_kind,source_id,economic_leg,journal_id,currency,amount_minor,source_hash,posted_by,posted_at,version)
select leg.scope_id,leg.scope_id,'event',leg.owner_event_id,leg.economic_leg_id,leg.journal_id,leg.currency,leg.amount_minor,
  encode(public.digest(leg.owner_event_id||chr(31)||leg.economic_leg_id||chr(31)||leg.journal_id||chr(31)||
    leg.currency||chr(31)||leg.amount_minor::text,'sha256'),'hex'),
  'migration:finance',leg.posted_at,1
from finance.economicleg leg
on conflict(source_kind,source_id,economic_leg) do nothing;

select runtime.record_migration_evidence('20260904054000',
  (select count(*) from finance.economicleg),(select count(*) from finance.postingreference),
  (select coalesce(sum(amount_minor),0) from finance.economicleg),(select coalesce(sum(amount_minor),0) from finance.postingreference),
  'select source_kind,count(*),sum(amount_minor) from finance.postingreference group by source_kind;',
  'select source_kind,source_id,economic_leg,journal_id,source_hash from finance.postingreference order by source_kind,source_id,economic_leg;');
insert into runtime.schemaversion(version,checksum)
values('20260904054000',encode(public.digest('20260904054000_backfill_finance_ledger','sha256'),'hex'));

commit;
