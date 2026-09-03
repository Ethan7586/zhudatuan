begin;

do $precondition$
begin
  if not exists(select 1 from runtime.schemaversion where version='20260903109000') then raise exception 'ORDER_READ_PROJECTION_PREVIOUS_HEAD_MISSING'; end if;
  if exists(select 1 from runtime.schemaversion where version='20260903110000') then raise exception 'ORDER_READ_PROJECTION_ALREADY_APPLIED'; end if;
  if not exists(select 1 from runtime.contractcatalog where artifact='commerce' and version='5.0.0'
    and checksum='353640f7fc3c991b6193a7f9e446ba0ecb143d94223af1a0c423466ab2de0e78' and status='active') then
    raise exception 'ORDER_READ_PROJECTION_PREVIOUS_CONTRACT_INVALID';
  end if;
end
$precondition$;

create table ordering.paymentread(
  order_id text primary key references ordering.orderrecord(id) on delete cascade,
  payment_id text not null unique,
  currency char(3) not null check(currency~'^[A-Z]{3}$'),
  captured_minor bigint not null check(captured_minor>=0),
  refunded_minor bigint not null check(refunded_minor between 0 and captured_minor),
  state text not null check(state in('authorized','captured','partiallyrefunded','refunded','cancelled')),
  updated_at timestamptz not null
);
create table ordering.paymenttenderread(
  order_id text not null references ordering.paymentread(order_id) on delete cascade,
  sequence integer not null check(sequence>0),kind text not null check(kind in('wechat','benefit','voucher')),
  reference_id text,amount_minor bigint not null check(amount_minor>0),
  state text not null check(state in('planned','held','captured','released')),primary key(order_id,sequence)
);
create table ordering.refundread(
  id text primary key,order_id text not null references ordering.orderrecord(id) on delete cascade,aftersale_id text,
  provider text not null,provider_reference text not null,amount_minor bigint not null check(amount_minor>0),
  currency char(3) not null check(currency~'^[A-Z]{3}$'),
  state text not null check(state in('requested','submitted','processing','succeeded','failed','cancelled')),
  reason text not null,created_at timestamptz not null,updated_at timestamptz not null
);
create index ordering_refundread_order on ordering.refundread(order_id,created_at,id);
create table ordering.refundtenderread(
  refund_id text not null references ordering.refundread(id) on delete cascade,sequence integer not null check(sequence>0),
  kind text not null check(kind in('wechat','benefit','voucher')),reference_id text,amount_minor bigint not null check(amount_minor>0),
  state text not null check(state in('planned','processing','succeeded','failed')),primary key(refund_id,sequence)
);
create table ordering.fulfillmentread(
  id text primary key,order_id text not null references ordering.orderrecord(id) on delete cascade,provider text,partner_id text,
  kind text not null check(kind in('shipment','delivery','pickup','service','digital')),
  state text not null check(state in('pending','submitted','accepted','processing','ready','completed','cancelled','failed')),
  external_reference text,created_at timestamptz not null,updated_at timestamptz not null
);
create index ordering_fulfillmentread_order on ordering.fulfillmentread(order_id,created_at,id);
create table ordering.fulfillmentmilestoneread(
  id text primary key,order_id text not null references ordering.orderrecord(id) on delete cascade,
  fulfillment_id text not null references ordering.fulfillmentread(id) on delete cascade,kind text not null,state text not null,
  tracking text,occurred_at timestamptz not null
);
create index ordering_fulfillmentmilestone_page on ordering.fulfillmentmilestoneread(fulfillment_id,occurred_at,id);

insert into ordering.paymentread(order_id,payment_id,currency,captured_minor,refunded_minor,state,updated_at)
select distinct on(intent.order_id) intent.order_id,payment.id,payment.currency,payment.captured_minor,payment.refunded_minor,
  payment.state,coalesce(capture.completed_at,orders.updated_at)
from payment.payment payment join payment.intent intent on intent.id=payment.intent_id
join ordering.orderrecord orders on orders.id=intent.order_id left join payment.capture capture on capture.order_id=intent.order_id
order by intent.order_id,payment.version desc,payment.id desc;
insert into ordering.paymenttenderread(order_id,sequence,kind,reference_id,amount_minor,state)
select projection.order_id,tender.sequence,tender.kind,tender.reference_id,tender.amount_minor,tender.state
from ordering.paymentread projection join payment.payment payment on payment.id=projection.payment_id
join payment.intenttender tender on tender.intent_id=payment.intent_id order by projection.order_id,tender.sequence;
insert into ordering.refundread(id,order_id,aftersale_id,provider,provider_reference,amount_minor,currency,state,reason,created_at,updated_at)
select refund.id,intent.order_id,refund.aftersale_id,refund.provider,refund.provider_reference,refund.amount_minor,refund.currency,
  refund.state,refund.reason,coalesce(command.created_at,orders.updated_at),coalesce(command.updated_at,orders.updated_at)
from payment.refund refund join payment.payment payment on payment.id=refund.payment_id
join payment.intent intent on intent.id=payment.intent_id join ordering.orderrecord orders on orders.id=intent.order_id
left join lateral(select created_at,updated_at from payment.refundcommand command where command.refund_id=refund.id order by command.created_at,command.id limit 1) command on true;
insert into ordering.refundtenderread(refund_id,sequence,kind,reference_id,amount_minor,state)
select tender.refund_id,tender.sequence,tender.kind,tender.reference_id,tender.amount_minor,tender.state
from payment.refundtender tender join ordering.refundread refund on refund.id=tender.refund_id;
insert into ordering.fulfillmentread(id,order_id,provider,partner_id,kind,state,external_reference,created_at,updated_at)
select fulfillment.id,fulfillment.order_id,fulfillment.provider,fulfillment.partner_id,fulfillment.kind,fulfillment.state,
  fulfillment.external_reference,coalesce(fulfillment.created_at,orders.created_at),coalesce(fulfillment.updated_at,orders.updated_at)
from fulfillment.fulfillmentorder fulfillment join ordering.orderrecord orders on orders.id=fulfillment.order_id;
insert into ordering.fulfillmentmilestoneread(id,order_id,fulfillment_id,kind,state,tracking,occurred_at)
select milestone.id,fulfillment.order_id,milestone.fulfillment_id,milestone.kind,milestone.state,milestone.external_id,milestone.occurred_at
from fulfillment.milestone milestone join fulfillment.fulfillmentorder fulfillment on fulfillment.id=milestone.fulfillment_id
join ordering.fulfillmentread projection on projection.id=fulfillment.id;

alter table ordering.paymentread enable row level security;
alter table ordering.paymenttenderread enable row level security;
alter table ordering.refundread enable row level security;
alter table ordering.refundtenderread enable row level security;
alter table ordering.fulfillmentread enable row level security;
alter table ordering.fulfillmentmilestoneread enable row level security;
create policy appscope on ordering.paymentread for all to shopapp using(exists(select 1 from ordering.orderrecord orders where orders.id=order_id and access.scope_allowed(orders.scope_id))) with check(exists(select 1 from ordering.orderrecord orders where orders.id=order_id and access.scope_allowed(orders.scope_id)));
create policy appscope on ordering.paymenttenderread for all to shopapp using(exists(select 1 from ordering.orderrecord orders where orders.id=order_id and access.scope_allowed(orders.scope_id))) with check(exists(select 1 from ordering.orderrecord orders where orders.id=order_id and access.scope_allowed(orders.scope_id)));
create policy appscope on ordering.refundread for all to shopapp using(exists(select 1 from ordering.orderrecord orders where orders.id=order_id and access.scope_allowed(orders.scope_id))) with check(exists(select 1 from ordering.orderrecord orders where orders.id=order_id and access.scope_allowed(orders.scope_id)));
create policy appscope on ordering.refundtenderread for all to shopapp using(exists(select 1 from ordering.refundread refund join ordering.orderrecord orders on orders.id=refund.order_id where refund.id=refund_id and access.scope_allowed(orders.scope_id))) with check(exists(select 1 from ordering.refundread refund join ordering.orderrecord orders on orders.id=refund.order_id where refund.id=refund_id and access.scope_allowed(orders.scope_id)));
create policy appscope on ordering.fulfillmentread for all to shopapp using(exists(select 1 from ordering.orderrecord orders where orders.id=order_id and access.scope_allowed(orders.scope_id))) with check(exists(select 1 from ordering.orderrecord orders where orders.id=order_id and access.scope_allowed(orders.scope_id)));
create policy appscope on ordering.fulfillmentmilestoneread for all to shopapp using(exists(select 1 from ordering.orderrecord orders where orders.id=order_id and access.scope_allowed(orders.scope_id))) with check(exists(select 1 from ordering.orderrecord orders where orders.id=order_id and access.scope_allowed(orders.scope_id)));
create policy jobscope on ordering.paymentread for all to shopjob using(true) with check(true);
create policy jobscope on ordering.paymenttenderread for all to shopjob using(true) with check(true);
create policy jobscope on ordering.refundread for all to shopjob using(true) with check(true);
create policy jobscope on ordering.refundtenderread for all to shopjob using(true) with check(true);
create policy jobscope on ordering.fulfillmentread for all to shopjob using(true) with check(true);
create policy jobscope on ordering.fulfillmentmilestoneread for all to shopjob using(true) with check(true);
create policy providerscope on ordering.paymentread for all to shopprovider using(true) with check(true);
create policy providerscope on ordering.paymenttenderread for all to shopprovider using(true) with check(true);
create policy providerscope on ordering.refundread for all to shopprovider using(true) with check(true);
create policy providerscope on ordering.refundtenderread for all to shopprovider using(true) with check(true);
create policy providerscope on ordering.fulfillmentread for all to shopprovider using(true) with check(true);
create policy providerscope on ordering.fulfillmentmilestoneread for all to shopprovider using(true) with check(true);
grant select,insert,update,delete on ordering.paymentread,ordering.paymenttenderread,ordering.refundread,ordering.refundtenderread,ordering.fulfillmentread,ordering.fulfillmentmilestoneread to shopapp,shopjob;
grant select,insert,update,delete on ordering.paymentread,ordering.paymenttenderread,ordering.refundread,ordering.refundtenderread,ordering.fulfillmentread,ordering.fulfillmentmilestoneread to shopprovider;

update runtime.contractcatalog set checksum='d21463e1526a44a08445f3a629bb41b2bb0bf0a03c6802a3d0137e592a12dead',
  operation_count=(select count(*) from runtime.operation),event_count=(select count(*) from runtime.event),published_at=clock_timestamp()
where artifact='commerce' and version='5.0.0' and status='active';
select runtime.record_migration_evidence('20260903110000',6,6,0,0,
  'select order_id,payment_id,captured_minor,refunded_minor from ordering.paymentread order by updated_at desc limit 20;',
  'select id,order_id,state from ordering.fulfillmentread order by updated_at desc limit 20;');
insert into runtime.schemaversion(version,checksum) values('20260903110000','d21463e1526a44a08445f3a629bb41b2bb0bf0a03c6802a3d0137e592a12dead');

do $assert$
begin
  if (select count(*) from ordering.paymentread)<>(select count(distinct intent.order_id) from payment.payment payment join payment.intent intent on intent.id=payment.intent_id) then raise exception 'ORDER_PAYMENT_PROJECTION_BACKFILL_INCOMPLETE'; end if;
  if (select count(*) from ordering.refundread)<>(select count(*) from payment.refund) then raise exception 'ORDER_REFUND_PROJECTION_BACKFILL_INCOMPLETE'; end if;
  if (select count(*) from ordering.fulfillmentread)<>(select count(*) from fulfillment.fulfillmentorder) then raise exception 'ORDER_FULFILLMENT_PROJECTION_BACKFILL_INCOMPLETE'; end if;
  if not exists(select 1 from runtime.contractcatalog where artifact='commerce' and version='5.0.0' and status='active'
    and checksum='d21463e1526a44a08445f3a629bb41b2bb0bf0a03c6802a3d0137e592a12dead' and operation_count=275 and event_count=103) then raise exception 'ORDER_READ_PROJECTION_CONTRACT_INVALID'; end if;
end
$assert$;

commit;
