begin;

do $precondition$ begin
  if not exists(select 1 from runtime.schemaversion where version='20260904027700') then raise exception 'ORDER_CANCELLATION_PREVIOUS_HEAD_MISSING'; end if;
  if exists(select 1 from runtime.schemaversion where version='20260904027800') then raise exception 'ORDER_CANCELLATION_ALREADY_APPLIED'; end if;
end $precondition$;

create table ordering.cancellation(
  order_id text not null,
  scope_id text not null,
  previous_state text not null check(previous_state in('created','awaitingpayment')),
  next_state text not null check(next_state='cancelled'),
  actor_id text not null,
  membership_id text not null,
  reason text not null check(length(reason) between 2 and 1000),
  event_id text not null unique,
  cancelled_at timestamptz not null,
  version bigint not null check(version>0),
  primary key(order_id,version)
);
create index ordering_cancellation_scope_page on ordering.cancellation(scope_id,cancelled_at desc,order_id desc) include(actor_id,membership_id,event_id,version);
create function ordering.reject_cancellation_mutation() returns trigger language plpgsql
set search_path=ordering,pg_temp as $function$
begin raise exception 'ORDER_CANCELLATION_APPEND_ONLY'; end $function$;
create trigger ordering_cancellation_immutable before update or delete on ordering.cancellation
for each row execute function ordering.reject_cancellation_mutation();
alter table ordering.cancellation enable row level security;
alter table ordering.cancellation force row level security;
create policy appscope on ordering.cancellation for all to shopapp using(access.scope_allowed(scope_id)) with check(access.scope_allowed(scope_id));
create policy jobscope on ordering.cancellation for all to shopjob using(true) with check(true);
grant select,insert on ordering.cancellation to shopapp,shopjob;

insert into runtime.operation(id,owner,method,path,contract_version)
values('order.orders.cancel','order','POST','/api/v1/orders/{orderid}/cancel','5.0.0');
update access.permission set risk='elevated',status='active' where code='order.cancel';
insert into capability.capability(id,kind,name,version,status)
values('order.orders.cancel','operation','order.orders.cancel',3,'active');
insert into capability.operation(operation_id,capability_id,permission_code,audience,targets)
values('order.orders.cancel','order.orders.cancel','order.cancel','public','{console,storefront,miniapp,store,supplier}');
insert into capability.entitlement(id,scope_id,capability_id,state,quota,effective_at,expires_at,version)
values('platform:order.orders.cancel','organization-platform-root','order.orders.cancel','enabled',null,'1970-01-01T00:00:00Z',null,0);
insert into access.rolepermission(role_id,permission_id,effect)
select role.id,permission.id,'allow' from access.role role cross join access.permission permission
where role.id in('role-platform-owner-v2','role:self') and permission.code='order.cancel' on conflict do nothing;

update runtime.contractcatalog set checksum='0b1566a88761bdd06b69454989192a7cd41769d931d51d36a1250f3d2d9aa277',
  operation_count=(select count(*) from runtime.operation),event_count=(select count(*) from runtime.event),published_at=clock_timestamp()
where artifact='commerce' and version='5.0.0' and status='active';

comment on table ordering.cancellation is 'Immutable user or operator cancellation receipts for unpaid orders.';
select runtime.record_migration_evidence(
  '20260904027800',0,0,0,0,
  'select order_id,previous_state,reason,cancelled_at,version from ordering.cancellation order by cancelled_at desc limit 20;',
  'select lifecycle_state,payment_state,fulfillment_state,count(*) from ordering.orderrecord group by lifecycle_state,payment_state,fulfillment_state;'
);
insert into runtime.schemaversion(version,checksum)
values('20260904027800',encode(public.digest('20260904027800_prepare_order_cancellation','sha256'),'hex'));

do $assert$ begin
  if not exists(select 1 from runtime.operation where id='order.orders.cancel' and method='POST' and path='/api/v1/orders/{orderid}/cancel')
    then raise exception 'ORDER_CANCELLATION_OPERATION_MISSING'; end if;
  if not exists(select 1 from access.permission where code='order.cancel' and risk='elevated' and status='active')
    then raise exception 'ORDER_CANCELLATION_PERMISSION_MISSING'; end if;
  if not exists(select 1 from pg_trigger where tgrelid='ordering.cancellation'::regclass and tgname='ordering_cancellation_immutable')
    then raise exception 'ORDER_CANCELLATION_IMMUTABILITY_MISSING'; end if;
  if not (select relrowsecurity and relforcerowsecurity from pg_class where oid='ordering.cancellation'::regclass)
    then raise exception 'ORDER_CANCELLATION_RLS_MISSING'; end if;
end $assert$;

commit;
