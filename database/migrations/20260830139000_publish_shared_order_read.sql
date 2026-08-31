begin;

do $precondition$ begin
  if not exists(select 1 from runtime.schemaversion where version='20260830138000') then
    raise exception 'SHARED_ORDER_READ_PREVIOUS_HEAD_MISSING';
  end if;
  if exists(select 1 from runtime.schemaversion where version='20260830139000') then
    raise exception 'SHARED_ORDER_READ_ALREADY_APPLIED';
  end if;
end $precondition$;

update capability.operation set audience='public' where operation_id='order.orders.read';

update runtime.contractcatalog
set checksum='deb0475d5fd5c5f0a16dccf0d67c25e7b12a7b8167941f3237eab7ff49a7f355',
    operation_count=(select count(*) from runtime.operation),
    event_count=(select count(*) from runtime.event),
    published_at=clock_timestamp()
where artifact='commerce' and version='3.0.0' and status='active';

select runtime.record_migration_evidence('20260830139000',1,1,0,0,
  'select operation_id,permission_code,audience from capability.operation where operation_id=''order.orders.read'';',
  'select mapping.role_id,permission.code from access.rolepermission mapping join access.permission permission on permission.id=mapping.permission_id where mapping.role_id=''role-platform-owner-v2'' and permission.code=''order.read'' and mapping.effect=''allow'';');
insert into runtime.schemaversion(version,checksum)
values('20260830139000','deb0475d5fd5c5f0a16dccf0d67c25e7b12a7b8167941f3237eab7ff49a7f355');

do $assert$ begin
  if not exists(select 1 from capability.operation where operation_id='order.orders.read' and audience='public') then
    raise exception 'SHARED_ORDER_READ_AUDIENCE_INVALID';
  end if;
  if not exists(select 1 from access.rolepermission mapping join access.permission permission on permission.id=mapping.permission_id
    where mapping.role_id='role-platform-owner-v2' and permission.code='order.read' and mapping.effect='allow')
    or not exists(select 1 from capability.entitlement entitlement where entitlement.scope_id='organization-platform-root'
      and entitlement.capability_id='order.orders.read' and entitlement.state='enabled') then
    raise exception 'SHARED_ORDER_READ_CONSOLE_CAPABILITY_MISSING';
  end if;
  if not exists(select 1 from runtime.contractcatalog
    where artifact='commerce' and version='3.0.0' and status='active'
      and checksum='deb0475d5fd5c5f0a16dccf0d67c25e7b12a7b8167941f3237eab7ff49a7f355'
      and operation_count=(select count(*) from runtime.operation)
      and event_count=(select count(*) from runtime.event)) then
    raise exception 'SHARED_ORDER_READ_CONTRACT_IDENTITY_INVALID';
  end if;
end $assert$;

commit;
