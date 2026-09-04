begin;

do $precondition$ begin
  if not exists(select 1 from runtime.schemaversion where version='20260904027800') then raise exception 'FULFILLMENT_PREVIOUS_HEAD_MISSING'; end if;
  if exists(select 1 from runtime.schemaversion where version='20260904027900') then raise exception 'FULFILLMENT_ALREADY_APPLIED'; end if;
end $precondition$;

alter table fulfillment.fulfillmentorder
  add column scope_id text,
  add column member_id text,
  add column route text;

update fulfillment.fulfillmentorder target set
  scope_id=orders.scope_id,
  member_id=orders.member_id,
  route=case when target.provider is not null then 'channel' when target.kind='digital' then 'digital' else 'physical' end
from ordering.orderrecord orders where orders.id=target.order_id;

alter table fulfillment.fulfillmentorder
  alter column scope_id set not null,
  alter column member_id set not null,
  alter column route set not null,
  add constraint fulfillmentorder_route_check check(route in('physical','digital','voucher','channel'));
alter table fulfillment.fulfillmentorder drop constraint fulfillmentorder_source_effect_id_suborder_id_key;
alter table fulfillment.fulfillmentorder add constraint fulfillmentorder_effect_plan_key unique(source_effect_id,idempotency_key);

alter table ordering.fulfillmentread add column version bigint not null default 0 check(version>=0);
alter table ordering.fulfillmentread drop constraint fulfillmentread_state_check;
alter table ordering.fulfillmentread add constraint fulfillmentread_state_check
  check(state in('pending','submitted','accepted','processing','ready','completed','cancelled','failed','needsaction'));

alter table fulfillment.fulfillmentorder drop constraint fulfillmentorder_state_check;
alter table fulfillment.fulfillmentorder add constraint fulfillmentorder_state_check
  check(state in('pending','submitted','accepted','processing','ready','completed','cancelled','failed','needsaction'));

create index fulfillment_scope_state on fulfillment.fulfillmentorder(scope_id,state,updated_at desc,id);
create index fulfillment_order_route on fulfillment.fulfillmentorder(order_id,route,id);

create table fulfillment.shipment(
  id text primary key,
  fulfillment_id text not null references fulfillment.fulfillmentorder(id),
  state text not null check(state in('draft','shipped','delivered','cancelled')),
  provider_reference text,
  shipped_at timestamptz,
  delivered_at timestamptz,
  created_at timestamptz not null,
  updated_at timestamptz not null,
  version bigint not null check(version>=0),
  unique(fulfillment_id,id)
);

create table fulfillment.package(
  id text primary key,
  shipment_id text not null references fulfillment.shipment(id),
  carrier text,
  tracking_number text not null,
  provider_reference text,
  state text not null check(state in('created','accepted','ready','shipped','intransit','outfordelivery','delivered','pickedup','completed','exception','returned')),
  created_at timestamptz not null,
  updated_at timestamptz not null,
  version bigint not null check(version>=0),
  unique(shipment_id,tracking_number),
  unique(provider_reference)
);

create table fulfillment.packageline(
  package_id text not null references fulfillment.package(id) on delete cascade,
  order_line_id text not null,
  quantity bigint not null check(quantity>0),
  primary key(package_id,order_line_id)
);

create table fulfillment.trackingevent(
  id text primary key,
  package_id text not null references fulfillment.package(id) on delete cascade,
  provider_event_id text not null,
  state text not null check(state in('created','accepted','ready','shipped','intransit','outfordelivery','delivered','pickedup','completed','exception','returned')),
  description text not null,
  location text,
  evidence jsonb not null check(jsonb_typeof(evidence)='object'),
  occurred_at timestamptz not null,
  received_at timestamptz not null,
  unique(package_id,provider_event_id)
);

create index fulfillment_tracking_timeline on fulfillment.trackingevent(package_id,occurred_at,id);

create table fulfillment.sagastep(
  fulfillment_id text not null references fulfillment.fulfillmentorder(id) on delete cascade,
  step text not null,
  idempotency_key text not null,
  state text not null check(state in('pending','running','succeeded','retry','failed','needsaction','compensated')),
  attempts integer not null check(attempts>=0),
  error_code text,
  checkpoint jsonb not null check(jsonb_typeof(checkpoint)='object'),
  next_attempt_at timestamptz,
  started_at timestamptz,
  completed_at timestamptz,
  updated_at timestamptz not null,
  version bigint not null check(version>=0),
  primary key(fulfillment_id,step),
  unique(idempotency_key)
);

create function fulfillment.reject_tracking_mutation()
returns trigger language plpgsql set search_path=fulfillment,pg_temp as $function$
begin
  raise exception 'FULFILLMENT_TRACKING_IMMUTABLE';
end
$function$;

create trigger trackingevent_immutable before update or delete on fulfillment.trackingevent
for each row execute function fulfillment.reject_tracking_mutation();

create function fulfillment.assert_package_quantity()
returns trigger language plpgsql set search_path=fulfillment,pg_temp as $function$
declare target_fulfillment text; maximum bigint; allocated bigint;
begin
  select shipment.fulfillment_id into target_fulfillment from fulfillment.package package
  join fulfillment.shipment shipment on shipment.id=package.shipment_id where package.id=new.package_id;
  select line.quantity into maximum from fulfillment.line line
  where line.fulfillment_id=target_fulfillment and line.order_line_id=new.order_line_id for update;
  if maximum is null then raise exception 'FULFILLMENT_PACKAGE_LINE_INVALID'; end if;
  select coalesce(sum(line.quantity),0) into allocated from fulfillment.packageline line
  join fulfillment.package package on package.id=line.package_id
  join fulfillment.shipment shipment on shipment.id=package.shipment_id
  where shipment.fulfillment_id=target_fulfillment and line.order_line_id=new.order_line_id
    and (line.package_id,line.order_line_id)<>(new.package_id,new.order_line_id);
  if allocated+new.quantity>maximum then raise exception 'FULFILLMENT_SHIPMENT_QUANTITY_EXCEEDED'; end if;
  return new;
end
$function$;

create trigger packageline_quantity before insert or update on fulfillment.packageline
for each row execute function fulfillment.assert_package_quantity();

create function fulfillment.assert_return_quantity()
returns trigger language plpgsql set search_path=fulfillment,pg_temp as $function$
declare target_fulfillment text; maximum bigint; returned bigint;
begin
  select record.fulfillment_id into target_fulfillment from fulfillment.returnrecord record where record.id=new.return_id;
  select line.quantity into maximum from fulfillment.line line
  where line.fulfillment_id=target_fulfillment and line.order_line_id=new.order_line_id for update;
  if maximum is null then raise exception 'FULFILLMENT_RETURN_LINE_INVALID'; end if;
  select coalesce(sum(line.quantity),0) into returned from fulfillment.returnline line
  join fulfillment.returnrecord record on record.id=line.return_id
  where record.fulfillment_id=target_fulfillment and record.state<>'rejected' and line.order_line_id=new.order_line_id
    and (line.return_id,line.order_line_id)<>(new.return_id,new.order_line_id);
  if returned+new.quantity>maximum then raise exception 'FULFILLMENT_RETURN_QUANTITY_EXCEEDED'; end if;
  return new;
end
$function$;

create trigger returnline_quantity before insert or update on fulfillment.returnline
for each row execute function fulfillment.assert_return_quantity();

insert into fulfillment.shipment(id,fulfillment_id,state,provider_reference,shipped_at,delivered_at,created_at,updated_at,version)
select 'shipment:migration:'||target.id,target.id,
  case when target.state='completed' then 'delivered' else 'shipped' end,target.external_reference,
  coalesce(min(milestone.occurred_at),target.updated_at),
  case when target.state='completed' then coalesce(max(milestone.occurred_at),target.updated_at) end,
  coalesce(target.created_at,clock_timestamp()),coalesce(target.updated_at,clock_timestamp()),0
from fulfillment.fulfillmentorder target join fulfillment.milestone milestone on milestone.fulfillment_id=target.id
group by target.id,target.state,target.external_reference,target.created_at,target.updated_at;

insert into fulfillment.package(id,shipment_id,carrier,tracking_number,provider_reference,state,created_at,updated_at,version)
select 'package:migration:'||target.id,'shipment:migration:'||target.id,null,
  coalesce((select milestone.external_id from fulfillment.milestone milestone where milestone.fulfillment_id=target.id and milestone.external_id is not null order by milestone.occurred_at desc,id desc limit 1),'MIGRATED-'||target.id),
  target.external_reference,case when target.state='completed' then 'delivered' else 'shipped' end,
  coalesce(target.created_at,clock_timestamp()),coalesce(target.updated_at,clock_timestamp()),0
from fulfillment.fulfillmentorder target where exists(select 1 from fulfillment.milestone milestone where milestone.fulfillment_id=target.id);

insert into fulfillment.packageline(package_id,order_line_id,quantity)
select 'package:migration:'||line.fulfillment_id,line.order_line_id,line.quantity from fulfillment.line line
where exists(select 1 from fulfillment.package package where package.id='package:migration:'||line.fulfillment_id);

insert into fulfillment.trackingevent(id,package_id,provider_event_id,state,description,location,evidence,occurred_at,received_at)
select 'tracking:migration:'||milestone.id,'package:migration:'||milestone.fulfillment_id,
  coalesce(milestone.external_id,milestone.id),
  case lower(milestone.state)
    when 'accepted' then 'accepted' when 'ready' then 'ready' when 'shipped' then 'shipped'
    when 'intransit' then 'intransit' when 'outfordelivery' then 'outfordelivery'
    when 'delivered' then 'delivered' when 'pickedup' then 'pickedup' when 'completed' then 'completed'
    when 'returned' then 'returned' when 'exception' then 'exception' else 'created' end,
  coalesce(nullif(milestone.evidence->>'description',''),milestone.kind||' · '||milestone.state),
  nullif(milestone.evidence->>'location',''),milestone.evidence,milestone.occurred_at,clock_timestamp()
from fulfillment.milestone milestone;

drop table fulfillment.milestone;

alter table fulfillment.fulfillmentorder force row level security;
alter table fulfillment.shipment enable row level security;
alter table fulfillment.shipment force row level security;
alter table fulfillment.package enable row level security;
alter table fulfillment.package force row level security;
alter table fulfillment.packageline enable row level security;
alter table fulfillment.packageline force row level security;
alter table fulfillment.trackingevent enable row level security;
alter table fulfillment.trackingevent force row level security;
alter table fulfillment.sagastep enable row level security;
alter table fulfillment.sagastep force row level security;

drop policy if exists appscope on fulfillment.fulfillmentorder;
drop policy if exists jobscope on fulfillment.fulfillmentorder;
create policy appscope on fulfillment.fulfillmentorder for all to shopapp using(access.scope_allowed(scope_id)) with check(access.scope_allowed(scope_id));
create policy jobscope on fulfillment.fulfillmentorder for all to shopjob using(true) with check(true);

create policy appscope on fulfillment.shipment for all to shopapp
  using(exists(select 1 from fulfillment.fulfillmentorder value where value.id=fulfillment_id and access.scope_allowed(value.scope_id)))
  with check(exists(select 1 from fulfillment.fulfillmentorder value where value.id=fulfillment_id and access.scope_allowed(value.scope_id)));
create policy jobscope on fulfillment.shipment for all to shopjob using(true) with check(true);
create policy appscope on fulfillment.package for all to shopapp
  using(exists(select 1 from fulfillment.shipment shipment join fulfillment.fulfillmentorder value on value.id=shipment.fulfillment_id where shipment.id=fulfillment.package.shipment_id and access.scope_allowed(value.scope_id)))
  with check(exists(select 1 from fulfillment.shipment shipment join fulfillment.fulfillmentorder value on value.id=shipment.fulfillment_id where shipment.id=fulfillment.package.shipment_id and access.scope_allowed(value.scope_id)));
create policy jobscope on fulfillment.package for all to shopjob using(true) with check(true);
create policy appscope on fulfillment.packageline for all to shopapp
  using(exists(select 1 from fulfillment.package package join fulfillment.shipment shipment on shipment.id=package.shipment_id join fulfillment.fulfillmentorder value on value.id=shipment.fulfillment_id where package.id=fulfillment.packageline.package_id and access.scope_allowed(value.scope_id)))
  with check(exists(select 1 from fulfillment.package package join fulfillment.shipment shipment on shipment.id=package.shipment_id join fulfillment.fulfillmentorder value on value.id=shipment.fulfillment_id where package.id=fulfillment.packageline.package_id and access.scope_allowed(value.scope_id)));
create policy jobscope on fulfillment.packageline for all to shopjob using(true) with check(true);
create policy appscope on fulfillment.trackingevent for all to shopapp
  using(exists(select 1 from fulfillment.package package join fulfillment.shipment shipment on shipment.id=package.shipment_id join fulfillment.fulfillmentorder value on value.id=shipment.fulfillment_id where package.id=fulfillment.trackingevent.package_id and access.scope_allowed(value.scope_id)))
  with check(false);
create policy jobscope on fulfillment.trackingevent for all to shopjob using(true) with check(true);
create policy appscope on fulfillment.sagastep for all to shopapp
  using(exists(select 1 from fulfillment.fulfillmentorder value where value.id=fulfillment_id and access.scope_allowed(value.scope_id)))
  with check(exists(select 1 from fulfillment.fulfillmentorder value where value.id=fulfillment_id and access.scope_allowed(value.scope_id)));
create policy jobscope on fulfillment.sagastep for all to shopjob using(true) with check(true);

grant select,insert,update,delete on fulfillment.fulfillmentorder,fulfillment.shipment,fulfillment.package,
  fulfillment.packageline,fulfillment.sagastep to shopapp,shopjob;
grant select on fulfillment.trackingevent to shopapp;
grant select,insert on fulfillment.trackingevent to shopjob;

do $$
begin
  if exists(select 1 from fulfillment.fulfillmentorder where scope_id is null or member_id is null or route is null) then
    raise exception 'FULFILLMENT_SCOPE_BACKFILL_INCOMPLETE';
  end if;
  if to_regclass('fulfillment.milestone') is not null or to_regclass('fulfillment.trackingevent') is null then
    raise exception 'FULFILLMENT_TRACKING_HARDCUT_INCOMPLETE';
  end if;
  if not exists(select 1 from information_schema.columns where table_schema='ordering' and table_name='fulfillmentread' and column_name='version') then
    raise exception 'ORDER_FULFILLMENT_VERSION_MISSING';
  end if;
end
$$;

insert into runtime.event(type,version,owner,schema_ref)
values('verification.completed',1,'verification','contract://events/verification.completed/v1');
update runtime.operation set contract_version='5.0.0' where owner='fulfillment';
update capability.capability set version=version+1 where id='fulfillment.shipments.create';
update runtime.contractcatalog set checksum='0b1566a88761bdd06b69454989192a7cd41769d931d51d36a1250f3d2d9aa277',
  operation_count=(select count(*) from runtime.operation),event_count=(select count(*) from runtime.event),published_at=clock_timestamp()
where artifact='commerce' and version='5.0.0' and status='active';

select runtime.record_migration_evidence(
  '20260904027900',(select count(*) from fulfillment.fulfillmentorder),(select count(*) from fulfillment.fulfillmentorder),0,0,
  'select scope_id,route,state,count(*) from fulfillment.fulfillmentorder group by scope_id,route,state;',
  'select fulfillment_id,step,state,attempts,error_code from fulfillment.sagastep where state in (''failed'',''needsaction'') order by updated_at desc limit 100;'
);
insert into runtime.schemaversion(version,checksum)
values('20260904027900',encode(public.digest('20260904027900_prepare_fulfillment','sha256'),'hex'));

do $contract$ begin
  if not exists(select 1 from runtime.event where type='verification.completed' and version=1 and owner='verification')
    then raise exception 'VERIFICATION_COMPLETED_EVENT_MISSING'; end if;
  if (select count(*) from runtime.operation)<>317 then raise exception 'FULFILLMENT_OPERATION_COUNT_INVALID'; end if;
  if (select count(*) from runtime.event)<>144 then raise exception 'FULFILLMENT_EVENT_COUNT_INVALID'; end if;
end $contract$;

commit;
