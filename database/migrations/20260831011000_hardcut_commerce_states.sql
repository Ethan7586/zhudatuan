begin;

create table runtime.migrationexception(
  id text primary key,
  migration text not null,
  aggregate_type text not null,
  aggregate_id text not null,
  reason text not null,
  evidence jsonb not null check(jsonb_typeof(evidence)='object'),
  state text not null check(state in('open','resolved')),
  detected_at timestamptz not null,
  resolved_at timestamptz,
  resolution text,
  unique(migration,aggregate_type,aggregate_id)
);

alter table runtime.migrationexception enable row level security;
create policy jobscope on runtime.migrationexception for all to shopjob using(true) with check(true);
grant select,insert,update on runtime.migrationexception to shopjob;

insert into runtime.migrationexception(id,migration,aggregate_type,aggregate_id,reason,evidence,state,detected_at)
select 'migrationexception:'||md5('20260831011000:payment:'||intent.id),'20260831011000','payment.intent',intent.id,
  'PAYMENT_PROVIDER_EVIDENCE_AMBIGUOUS',
  jsonb_build_object('state',intent.state,'attempts',coalesce((select jsonb_agg(jsonb_build_object('id',attempt.id,'state',attempt.state)
    order by attempt.requested_at,attempt.id) from payment.attempt attempt where attempt.intent_id=intent.id),'[]'::jsonb)),
  'open',clock_timestamp()
from payment.intent intent
where intent.state in('authorizing','authorized')
and not exists(select 1 from payment.payment payment where payment.intent_id=intent.id)
and not exists(select 1 from payment.attempt attempt where attempt.intent_id=intent.id and attempt.state in('started','pending','unknown'))
on conflict(migration,aggregate_type,aggregate_id) do nothing;

commit;

do $$
begin
  if exists(select 1 from runtime.migrationexception where migration='20260831011000' and state='open') then
    raise exception 'COMMERCE_STATE_MIGRATION_BLOCKED';
  end if;
end
$$;

begin;

alter table inventory.reservation drop constraint reservation_state_check;
update inventory.reservation set state='reserved',version=version+1 where state='active';
alter table inventory.reservation add constraint reservation_state_check check(state in('reserved','committed','released','expired'));
drop index inventory.inventory_reservation_active;
create index inventory_reservation_reserved on inventory.reservation(stockitem_id,expires_at,id) where state='reserved';

alter table voucher.voucher drop constraint voucher_state_check;
update voucher.voucher set state=case state when 'created' then 'inactive' when 'bound' then 'active' when 'reserved' then 'held' else state end,
  version=version+1 where state in('created','bound','reserved');
alter table voucher.voucher add constraint voucher_state_check
  check(state in('inactive','active','held','redeemed','reversed','disabled','expired','void'));

alter table payment.intent drop constraint intent_state_check;
update payment.intent intent set state=case
  when exists(select 1 from payment.payment payment where payment.intent_id=intent.id) then 'captured'
  when exists(select 1 from payment.attempt attempt where attempt.intent_id=intent.id and attempt.state in('pending','unknown')) then 'pending'
  when exists(select 1 from payment.attempt attempt where attempt.intent_id=intent.id and attempt.state='started') then 'preparing'
  else state end,
  version=version+1 where state in('authorizing','authorized');
alter table payment.intent add constraint intent_state_check
  check(state in('created','preparing','pending','captured','partiallyrefunded','refunded','failed','cancelled','expired'));

alter table payment.payment drop constraint payment_state_check;
update payment.payment set state='partiallyrefunded',version=version+1 where state='partially_refunded';
alter table payment.payment add constraint payment_state_check
  check(state in('authorized','captured','partiallyrefunded','refunded','cancelled'));

alter table ordering.orderrecord drop constraint orderrecord_lifecycle_state_check;
update ordering.orderrecord set lifecycle_state=case
  when lifecycle_state='cancelled' or fulfillment_state='cancelled' then 'cancelled'
  when fulfillment_state='returned' or lifecycle_state='closed' then 'completed'
  when fulfillment_state='received' then 'received'
  when fulfillment_state in('shipped','delivered') then 'shipped'
  when fulfillment_state='processing' then 'fulfilling'
  when payment_state in('paid','partially_refunded','refunded') then 'paid'
  else 'awaitingpayment' end,
  version=version+1;
alter table ordering.orderrecord add constraint orderrecord_lifecycle_state_check
  check(lifecycle_state in('created','awaitingpayment','paid','fulfilling','shipped','received','completed','cancelled'));

commit;
