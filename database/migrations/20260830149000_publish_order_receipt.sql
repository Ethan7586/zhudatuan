begin;

do $precondition$ begin
  if not exists(select 1 from runtime.schemaversion where version='20260830148000') then raise exception 'ORDER_RECEIPT_PREVIOUS_HEAD_MISSING'; end if;
  if exists(select 1 from runtime.schemaversion where version='20260830149000') then raise exception 'ORDER_RECEIPT_ALREADY_APPLIED'; end if;
end $precondition$;

alter table ordering.orderrecord drop constraint orderrecord_fulfillment_state_check;
alter table ordering.orderrecord add constraint orderrecord_fulfillment_state_check
check(fulfillment_state in('unallocated','allocated','processing','shipped','delivered','received','cancelled','returned')) not valid;
alter table ordering.orderrecord validate constraint orderrecord_fulfillment_state_check;
alter table ordering.orderrecord add column received_at timestamptz;
alter table ordering.orderrecord add column receipt_event_id text unique;

create table ordering.receipt(
  order_id text not null,
  scope_id text not null,
  previous_state text not null check(previous_state in('shipped','delivered')),
  next_state text not null check(next_state='received'),
  actor_id text not null,
  membership_id text not null,
  reason text,
  event_id text not null unique,
  received_at timestamptz not null,
  version bigint not null check(version>0),
  primary key(order_id,version)
);
create index ordering_receipt_scope_page on ordering.receipt(scope_id,received_at desc,order_id desc) include(actor_id,membership_id,event_id,version);
create or replace function ordering.reject_receipt_mutation() returns trigger language plpgsql
set search_path=ordering,pg_temp as $function$
begin raise exception 'ORDER_RECEIPT_APPEND_ONLY'; end $function$;
create trigger ordering_receipt_immutable before update or delete on ordering.receipt
for each row execute function ordering.reject_receipt_mutation();
alter table ordering.receipt enable row level security;
alter table ordering.receipt force row level security;
create policy appscope on ordering.receipt for all to shopapp using(access.scope_allowed(scope_id)) with check(access.scope_allowed(scope_id));
create policy jobscope on ordering.receipt for all to shopjob using(true) with check(true);
grant select,insert on ordering.receipt to shopapp,shopjob;

insert into runtime.operation(id,owner,method,path,contract_version)
values('order.orders.receive','order','POST','/api/v1/orders/{orderid}/receive','3.0.0');
insert into access.permission(id,code,risk,status)
values('permission:'||substr(encode(public.digest('order.receive','sha256'),'hex'),1,24),'order.receive','elevated','active');
insert into capability.capability(id,kind,name,version,status)
values('order.orders.receive','operation','order.orders.receive',3,'active');
insert into capability.operation(operation_id,capability_id,permission_code,audience)
values('order.orders.receive','order.orders.receive','order.receive','public');
insert into capability.entitlement(id,scope_id,capability_id,state,quota,effective_at,expires_at,version)
values('platform:order.orders.receive','organization-platform-root','order.orders.receive','enabled',null,'1970-01-01T00:00:00Z',null,0);
delete from access.rolepermission mapping using access.permission permission
where mapping.role_id in('role-platform-owner-v2','role:self') and mapping.permission_id=permission.id
  and permission.code='order.receive' and mapping.effect='deny';
insert into access.rolepermission(role_id,permission_id,effect)
select role.id,permission.id,'allow' from access.role role cross join access.permission permission
where role.id in('role-platform-owner-v2','role:self') and permission.code='order.receive' on conflict do nothing;
insert into runtime.event(type,version,owner,schema_ref)
values('order.received',1,'order','contract://events/order.received/v1');

update runtime.contractcatalog set checksum=encode(public.digest('commerce:3.0.0:orderreceipt','sha256'),'hex'),
  operation_count=(select count(*) from runtime.operation),event_count=(select count(*) from runtime.event),published_at=clock_timestamp()
where artifact='commerce' and version='3.0.0' and status='active';
insert into runtime.schemaversion(version,checksum)
values('20260830149000',encode(public.digest('20260830149000_publish_order_receipt','sha256'),'hex'));

commit;
