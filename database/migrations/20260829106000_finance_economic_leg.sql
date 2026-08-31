begin;

do $precondition$ begin
  if not exists(select 1 from runtime.schemaversion where version='20260829105000') then raise exception 'FINANCE_LEG_PREVIOUS_HEAD_MISSING'; end if;
  if exists(select 1 from runtime.schemaversion where version='20260829106000') or to_regclass('finance.economicleg') is not null then
    raise exception 'FINANCE_LEG_ALREADY_APPLIED';
  end if;
end $precondition$;

create temporary table finance_reconcile on commit drop as
select count(*)::bigint rows,coalesce(sum(amount_minor),0)::numeric minor from(
  select journal.id,sum(entry.amount_minor) filter(where entry.side='debit') amount_minor
  from finance.journal journal join finance.entry entry on entry.journal_id=journal.id
  where journal.state='posted' group by journal.id
) posted;

create table finance.economicleg(
  owner_event_id text not null,
  economic_leg_id text not null,
  journal_id text not null unique references finance.journal(id),
  scope_id text not null,
  currency char(3) not null,
  amount_minor bigint not null,
  posted_at timestamptz not null,
  primary key(owner_event_id,economic_leg_id)
);
insert into finance.economicleg(owner_event_id,economic_leg_id,journal_id,scope_id,currency,amount_minor,posted_at)
select journal.reference_id,journal.reference_type,journal.id,journal.scope_id,journal.currency,
  sum(entry.amount_minor) filter(where entry.side='debit'),coalesce(journal.posted_at,clock_timestamp())
from finance.journal journal join finance.entry entry on entry.journal_id=journal.id
where journal.state='posted' group by journal.id;
alter table finance.economicleg add constraint finance_economic_leg_amount check(amount_minor>0) not valid;
alter table finance.economicleg validate constraint finance_economic_leg_amount;

create table payment.refundreceipt(
  id text primary key,
  refund_id text not null references payment.refund(id),
  provider_attempt_id text not null unique references payment.providerattempt(id),
  scope_id text not null,
  outcome text not null check(outcome in('succeeded','unknown')),
  provider_state text,
  provider_reference text,
  error_code text,
  receipt_hash char(64) not null check(receipt_hash~'^[0-9a-f]{64}$'),
  recorded_at timestamptz not null
);

create or replace function runtime.reject_receipt_mutation() returns trigger language plpgsql
set search_path=pg_catalog,pg_temp as $function$
begin raise exception 'RECEIPT_APPEND_ONLY:%',tg_table_schema||'.'||tg_table_name; end $function$;
create trigger payment_observation_immutable before update or delete on payment.observation
for each row execute function runtime.reject_receipt_mutation();
create trigger payment_capture_immutable before update or delete on payment.capture
for each row execute function runtime.reject_receipt_mutation();
create trigger payment_refundreceipt_immutable before update or delete on payment.refundreceipt
for each row execute function runtime.reject_receipt_mutation();
create trigger voucher_redemption_immutable before update or delete on voucher.redemption
for each row execute function runtime.reject_receipt_mutation();
create trigger voucher_reversal_immutable before update or delete on voucher.reversal
for each row execute function runtime.reject_receipt_mutation();

create or replace function finance.reject_economic_leg_mutation() returns trigger language plpgsql set search_path=finance,pg_temp as $function$
begin raise exception 'FINANCE_ECONOMIC_LEG_APPEND_ONLY'; end $function$;
create trigger finance_economic_leg_immutable before update or delete on finance.economicleg
for each row execute function finance.reject_economic_leg_mutation();

create or replace function finance.assert_journal_balance() returns trigger language plpgsql set search_path=finance,pg_temp as $function$
declare selected text;
begin
  if tg_table_name='journal' then selected:=new.id; else selected:=new.journal_id; end if;
  if exists(select 1 from finance.journal where id=selected and state='posted') and
    (select count(*)<>2 or coalesce(sum(case when side='debit' then amount_minor else -amount_minor end),0)<>0
      from finance.entry where journal_id=selected) then raise exception 'FINANCE_JOURNAL_UNBALANCED:%',selected;
  end if;
  return null;
end $function$;
create constraint trigger finance_journal_deferred_balance after insert on finance.journal deferrable initially deferred
for each row execute function finance.assert_journal_balance();
create constraint trigger finance_entry_deferred_balance after insert on finance.entry deferrable initially deferred
for each row execute function finance.assert_journal_balance();
create index finance_economic_leg_scope on finance.economicleg(scope_id,posted_at desc,owner_event_id,economic_leg_id);
create index payment_refundreceipt_scope on payment.refundreceipt(scope_id,recorded_at desc,refund_id);
alter table finance.economicleg enable row level security;
alter table payment.refundreceipt enable row level security;
create policy appselect on finance.economicleg for select to shopapp using(access.scope_allowed(scope_id));
create policy appinsert on finance.economicleg for insert to shopapp with check(access.scope_allowed(scope_id));
create policy jobscope on finance.economicleg for all to shopjob using(true) with check(true);
create policy appselect on payment.refundreceipt for select to shopapp using(access.scope_allowed(scope_id));
create policy jobscope on payment.refundreceipt for all to shopjob using(true) with check(true);
grant select,insert on finance.economicleg to shopapp,shopjob;
grant select on payment.refundreceipt to shopapp;
grant select,insert on payment.refundreceipt to shopjob;

select runtime.record_migration_evidence('20260829106000',(select rows from finance_reconcile),(select count(*) from finance.economicleg),
  (select minor from finance_reconcile),(select coalesce(sum(amount_minor),0) from finance.economicleg),
  'create index concurrently if not exists finance_economic_leg_scope_live on finance.economicleg(scope_id,posted_at desc,owner_event_id,economic_leg_id);',
  'select journal_id from finance.economicleg group by journal_id having count(*)>1;');
insert into runtime.schemaversion(version,checksum)
values('20260829106000',encode(public.digest('20260829106000_finance_economic_leg','sha256'),'hex'));

commit;
