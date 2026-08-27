begin;

alter table checkout.address
  add column recipient_masked text not null default '***',
  add column mobile_masked text not null default '***',
  add column address_masked text not null default '***',
  add column region_code text not null default 'unknown';

create table ordering.reminder(
  id text primary key,
  order_id text not null references ordering.orderrecord(id),
  member_id text not null,
  kind text not null check(kind in('fulfillment')),
  state text not null check(state in('queued','delivered','failed')),
  created_at timestamptz not null
);
create index ordering_reminder_order_time on ordering.reminder(order_id,created_at desc);

alter table ordering.reminder enable row level security;
create policy appscope on ordering.reminder for all to shopapp
  using(member_id=current_setting('app.scope_id',true) or exists(select 1 from organization.unitclosure closure
    join ordering.orderrecord orders on orders.id=order_id where closure.ancestor_id=current_setting('app.scope_id',true) and closure.descendant_id=orders.mall_id))
  with check(member_id=current_setting('app.scope_id',true) or exists(select 1 from organization.unitclosure closure
    join ordering.orderrecord orders on orders.id=order_id where closure.ancestor_id=current_setting('app.scope_id',true) and closure.descendant_id=orders.mall_id));
create policy jobscope on ordering.reminder for all to shopjob using(true) with check(true);
grant select,insert,update,delete on ordering.reminder to shopapp,shopjob;

insert into access.rolepermission(role_id,permission_id,effect)
select 'role:self',permission.id,'allow' from access.permission permission where permission.code in(
  'member.profile.read','member.address.read','member.address.manage','order.reminder.create','fulfillment.read')
on conflict do nothing;

insert into runtime.schemaversion(version,checksum)
values('20260821037000','2a1ca1870b000ab5ea8848d92e2587e41ec80dff7c0b951258b49039bce414e5');

do $assert$
begin
  if (select count(*) from runtime.operation)<>154 then raise exception 'OPERATION_REGISTRY_COUNT_MISMATCH'; end if;
  if to_regclass('ordering.reminder') is null then raise exception 'ORDER_REMINDER_TABLE_MISSING'; end if;
  if not exists(select 1 from runtime.schemaversion where version='20260821037000') then raise exception 'TARGET_SCHEMA_VERSION_MISSING'; end if;
end $assert$;

commit;
