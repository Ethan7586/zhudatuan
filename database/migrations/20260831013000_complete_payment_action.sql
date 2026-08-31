begin;

alter table payment.intent
  add column scope_id text,
  add column mall_id text,
  add column order_number text;

update payment.intent intent set scope_id=orders.scope_id,mall_id=orders.mall_id,order_number=orders.order_number
from ordering.orderrecord orders where orders.id=intent.order_id;

alter table payment.intent
  alter column scope_id set not null,
  alter column mall_id set not null,
  alter column order_number set not null;

create index payment_intent_scope_member on payment.intent(scope_id,member_id,expires_at desc,id);

create table payment.action(
  id text primary key,
  intent_id text not null references payment.intent(id) on delete cascade,
  attempt_id text references payment.attempt(id),
  kind text not null check(kind in('wechat')),
  state text not null check(state in('active','consumed','expired')),
  parameters jsonb not null check(jsonb_typeof(parameters)='object'),
  provider_request_id text,
  expires_at timestamptz not null,
  created_at timestamptz not null,
  consumed_at timestamptz,
  version bigint not null check(version>=0),
  unique(intent_id,attempt_id)
);

insert into payment.action(id,intent_id,attempt_id,kind,state,parameters,provider_request_id,expires_at,created_at,version)
select 'action:'||prepay.intent_id,prepay.intent_id,
  (select attempt.id from payment.attempt attempt where attempt.intent_id=prepay.intent_id
    order by attempt.requested_at desc,attempt.id desc limit 1),
  'wechat',case when intent.state='captured' then 'consumed' else 'active' end,
  prepay.parameters,prepay.provider_request_id,intent.expires_at,prepay.created_at,0
from payment.prepay prepay join payment.intent intent on intent.id=prepay.intent_id;

drop table payment.prepay;

alter table payment.refund drop constraint refund_aftersale_id_fkey;

drop policy appscope on payment.intenttender;
create policy appscope on payment.intenttender for all to shopapp
  using(exists(select 1 from payment.intent intent where intent.id=intent_id and access.scope_allowed(intent.scope_id)))
  with check(exists(select 1 from payment.intent intent where intent.id=intent_id and access.scope_allowed(intent.scope_id)));

drop policy appscope on payment.refundtender;
create policy appscope on payment.refundtender for all to shopapp
  using(exists(select 1 from payment.refund refund join payment.payment payment on payment.id=refund.payment_id
    join payment.intent intent on intent.id=payment.intent_id where refund.id=refund_id and access.scope_allowed(intent.scope_id)))
  with check(exists(select 1 from payment.refund refund join payment.payment payment on payment.id=refund.payment_id
    join payment.intent intent on intent.id=payment.intent_id where refund.id=refund_id and access.scope_allowed(intent.scope_id)));

alter table payment.action enable row level security;
create policy appscope on payment.action for all to shopapp
  using(exists(select 1 from payment.intent intent where intent.id=intent_id and access.scope_allowed(intent.scope_id)))
  with check(exists(select 1 from payment.intent intent where intent.id=intent_id and access.scope_allowed(intent.scope_id)));
create policy jobscope on payment.action for all to shopjob using(true) with check(true);
grant select,insert,update,delete on payment.action to shopapp,shopjob;

do $$
begin
  if exists(select 1 from pg_constraint where conrelid='payment.refund'::regclass and confrelid='ordering.aftersale'::regclass) then
    raise exception 'PAYMENT_AFTERSALE_CROSS_MODULE_FK_REMAINS';
  end if;
  if to_regclass('payment.prepay') is not null or to_regclass('payment.action') is null then
    raise exception 'PAYMENT_ACTION_HARDCUT_INVALID';
  end if;
end
$$;

commit;
