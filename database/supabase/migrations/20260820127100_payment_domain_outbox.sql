-- One intent represents the order-level capture; welfare and meal payments
-- remain immutable tender identities for accounting and original-route refund.
create table public.payment_intents(
  id uuid primary key default gen_random_uuid(),
  tenant_id text not null references public.tenants(id),
  mall_id text not null references public.malls(id),
  user_id text not null references public.users(id),
  order_id text not null references public.orders(id),
  source text not null check(source='internal'),
  currency text not null check(currency='CNY'),
  amount_cents bigint not null check(amount_cents>0),
  status text not null check(status='succeeded'),
  idempotency_key text not null,
  completed_at timestamptz not null,
  created_at timestamptz not null default now(),
  unique(tenant_id,order_id),unique(tenant_id,mall_id,idempotency_key)
);
alter table public.payments
  add column payment_intent_id uuid references public.payment_intents(id);
create unique index payments_internal_intent_channel
on public.payments(payment_intent_id,channel)
where payment_intent_id is not null;

alter table public.wechat_payment_outbox rename to payment_outbox;
alter table public.payment_outbox
  add column source text not null default 'wechat',
  add column payment_intent_id uuid references public.payment_intents(id),
  alter column payment_id drop not null,
  alter column attempt_id drop not null,
  drop constraint wechat_payment_outbox_topic_check,
  add constraint payment_outbox_source_check
    check(source in('wechat','internal')),
  add constraint payment_outbox_topic_check check(
    (source='wechat' and topic in(
      'order.payment_succeeded','order.payment_terminal',
      'order.payment_reconciliation_required') and payment_id is not null
      and payment_intent_id is null and attempt_id is not null)
    or(source='internal' and topic='order.payment_succeeded'
      and payment_id is null and payment_intent_id is not null
      and attempt_id is null));
alter table public.payment_event_effects
  add column payment_intent_id uuid references public.payment_intents(id),
  alter column payment_id drop not null,
  add constraint payment_event_effects_payment_anchor_check
    check((payment_id is not null)<>(payment_intent_id is not null));

revoke all on table public.payment_intents,public.payment_outbox
from public,anon,authenticated,service_role;
alter table public.payment_intents enable row level security;
comment on column public.payments.status is
  'succeeded means captured with complete local evidence; partial refunds remain succeeded; refunded means cumulative successful refunds equal the captured amount for every channel';
create trigger payment_intents_immutable before update or delete
on public.payment_intents for each row execute function public.reject_immutable_change();

alter function public.prepare_wechat_payment_outbox_envelope()
  rename to prepare_payment_outbox_envelope;
alter function public.enforce_wechat_payment_outbox_envelope_immutable()
  rename to enforce_payment_outbox_envelope_immutable;
alter trigger wechat_payment_outbox_prepare_envelope on public.payment_outbox
  rename to payment_outbox_prepare_envelope;
alter trigger wechat_payment_outbox_envelope_immutable on public.payment_outbox
  rename to payment_outbox_envelope_immutable;
alter index if exists public.wechat_payment_outbox_delivery_lookup
  rename to payment_outbox_delivery_lookup;
alter index if exists public.wechat_payment_outbox_aggregate_version
  rename to payment_outbox_aggregate_version;

create or replace function public.prepare_payment_outbox_envelope()
returns trigger language plpgsql set search_path=public,pg_temp as $$
declare resolved_tenant_id text;
begin
  perform pg_advisory_xact_lock(hashtextextended('payment-order:'||new.order_id,0));
  select orders.tenant_id into strict resolved_tenant_id
  from public.orders orders where orders.id=new.order_id;
  new.tenant_id:=resolved_tenant_id;
  new.aggregate_type:='order'; new.aggregate_id:=new.order_id;
  select coalesce(max(outbox.aggregate_version),0)+1
  into new.aggregate_version from public.payment_outbox outbox
  where outbox.aggregate_id=new.order_id;
  new.event_type:=new.topic; new.event_version:=1;
  new.headers_json:=coalesce(new.headers_json,'{}'::jsonb)
    ||jsonb_build_object('correlationId',new.event_key,
      'occurredAt',new.created_at,'schemaVersion',1,'source',new.source);
  return new;
end $$;

create or replace function public.enforce_payment_outbox_envelope_immutable()
returns trigger language plpgsql set search_path=public,pg_temp as $$
begin
  if row(new.event_key,new.source,new.topic,new.tenant_id,new.aggregate_type,
      new.aggregate_id,new.aggregate_version,new.event_type,new.event_version,
      new.headers_json,new.order_id,new.payment_id,new.payment_intent_id,
      new.attempt_id,new.payload_json,new.created_at)
    is distinct from row(old.event_key,old.source,old.topic,old.tenant_id,
      old.aggregate_type,old.aggregate_id,old.aggregate_version,old.event_type,
      old.event_version,old.headers_json,old.order_id,old.payment_id,
      old.payment_intent_id,old.attempt_id,old.payload_json,old.created_at)
  then raise exception 'PAYMENT_OUTBOX_ENVELOPE_IMMUTABLE'; end if;
  return new;
end $$;

create function public.internal_payment_tender_valid(
  p_order_id text,p_payment_id text
) returns boolean language sql stable security definer
set search_path=public,pg_temp as $$
  select coalesce((select
    payment.channel in('welfare','meal')
    and ((payment.status='succeeded' and coalesce((select
        sum(refund.amount_cents) from public.refunds refund
        where refund.payment_id=payment.id and refund.status='succeeded'),0)
          <payment.amount_cents)
      or (payment.status='refunded' and coalesce((select
        sum(refund.amount_cents) from public.refunds refund
        where refund.payment_id=payment.id and refund.status='succeeded'),0)
          =payment.amount_cents))
    and payment.provider_trade_no is null
    and payment.tenant_id=orders.tenant_id and payment.mall_id=orders.mall_id
    and payment.user_id=orders.user_id
    and not exists(select 1 from public.refunds refund
      where refund.payment_id=payment.id
        and (refund.tenant_id<>orders.tenant_id
          or refund.mall_id<>orders.mall_id or refund.order_id<>orders.id))
    and (select count(*) from public.payment_allocations allocation
      join public.welfare_accounts account on account.id=allocation.account_id
      where allocation.payment_id=payment.id and allocation.order_id=orders.id
        and allocation.tenant_id=orders.tenant_id
        and allocation.mall_id=orders.mall_id
        and allocation.channel=payment.channel
        and allocation.amount_cents=payment.amount_cents
        and account.account_type=payment.channel
        and account.tenant_id=orders.tenant_id
        and account.mall_id=orders.mall_id
        and account.user_id=orders.user_id)=1
    and (select count(*) from public.account_ledgers ledger
      join public.payment_allocations allocation
        on allocation.account_id=ledger.account_id
        and allocation.payment_id=payment.id
      where ledger.business_type='order_payment'
        and ledger.business_id=orders.id
        and ledger.idempotency_key=payment.idempotency_key
        and ledger.direction='debit'
        and ledger.amount_cents=payment.amount_cents)=1
    from public.payments payment join public.orders orders
      on orders.id=payment.order_id
    where orders.id=p_order_id and payment.id=p_payment_id),false)
$$;

create function public.internal_payment_intent_valid(p_intent_id uuid)
returns boolean language sql stable security definer
set search_path=public,pg_temp as $$
  select coalesce((select intent.status='succeeded'
    and intent.source='internal' and intent.currency='CNY'
    and orders.status in(
      'paid','processing','shipped','completed','refund_pending','refunded')
    and orders.paid_cents=orders.payable_cents
    and intent.amount_cents=orders.payable_cents
    and(select count(*) from public.payments payment
      where payment.payment_intent_id=intent.id)
      =(select count(distinct payment.channel) from public.payments payment
        where payment.payment_intent_id=intent.id)
    and(select count(*) from public.payments payment
      where payment.payment_intent_id=intent.id) between 1 and 2
    and(select sum(payment.amount_cents) from public.payments payment
      where payment.payment_intent_id=intent.id)=intent.amount_cents
    and not exists(select 1 from public.payments payment
      where payment.payment_intent_id=intent.id
        and not public.internal_payment_tender_valid(orders.id,payment.id))
    from public.payment_intents intent join public.orders orders
      on orders.id=intent.order_id and orders.tenant_id=intent.tenant_id
      and orders.mall_id=intent.mall_id and orders.user_id=intent.user_id
    where intent.id=p_intent_id),false)
$$;

create function public.emit_internal_payment_outbox()
returns trigger language plpgsql security definer
set search_path=public,pg_temp as $$
declare tender_count integer; tender_total bigint; tender_channels integer;
  key_count integer; base_key text; intent_id uuid:=gen_random_uuid();
begin
  if old.status<>'pending_payment' or new.status<>'paid'
    or new.paid_cents<>new.payable_cents
  then return new; end if;
  if exists(select 1 from public.payment_intents intent
    where intent.tenant_id=new.tenant_id and intent.order_id=new.id)
  then raise exception 'INTERNAL_PAYMENT_INTENT_ALREADY_EXISTS'; end if;
  select count(*),coalesce(sum(payment.amount_cents),0),
    count(distinct payment.channel),
    count(distinct regexp_replace(payment.idempotency_key,
      ':(welfare|meal)$','')),min(regexp_replace(payment.idempotency_key,
      ':(welfare|meal)$',''))
  into tender_count,tender_total,tender_channels,key_count,base_key
  from public.payments payment where payment.order_id=new.id
    and payment.channel in('welfare','meal');
  if tender_count=0 then return new; end if;
  if tender_count<>tender_channels or tender_count not between 1 and 2
    or tender_total<>new.payable_cents or key_count<>1
    or exists(select 1 from public.payments payment where payment.order_id=new.id
      and payment.channel not in('welfare','meal'))
    or exists(select 1 from public.payments payment where payment.order_id=new.id
      and payment.channel in('welfare','meal')
      and not public.internal_payment_tender_valid(new.id,payment.id))
  then raise exception 'INTERNAL_PAYMENT_INTENT_EVIDENCE_INVALID'; end if;
  insert into public.payment_intents(id,tenant_id,mall_id,user_id,order_id,
    source,currency,amount_cents,status,idempotency_key,completed_at)
  values(intent_id,new.tenant_id,new.mall_id,new.user_id,new.id,'internal',
    'CNY',new.payable_cents,'succeeded',base_key,coalesce(new.paid_at,now()));
  update public.payments set payment_intent_id=intent_id
  where order_id=new.id and channel in('welfare','meal');
  if not public.internal_payment_intent_valid(intent_id)
  then raise exception 'INTERNAL_PAYMENT_INTENT_INCOMPLETE'; end if;
  insert into public.payment_outbox(event_key,source,topic,order_id,
    payment_id,payment_intent_id,attempt_id,payload_json,created_at,updated_at)
  values('payment-intent:'||intent_id||':captured:v1','internal',
    'order.payment_succeeded',new.id,null,intent_id,null,
    jsonb_build_object('orderId',new.id,'paymentIntentId',intent_id,
      'amountCents',new.payable_cents,'currency','CNY','outcome','applied'),
    coalesce(new.paid_at,now()),now());
  return new;
end $$;

create trigger order_internal_payment_outbox
after update of status,paid_cents on public.orders
for each row execute function public.emit_internal_payment_outbox();
revoke all on function public.emit_internal_payment_outbox(),
  public.internal_payment_tender_valid(text,text),
  public.internal_payment_intent_valid(uuid)
from public,anon,authenticated,service_role;
