begin;

select pg_advisory_xact_lock(hashtext('zhudatuan:publish-runtime-catalog-alignment:v1'));

do $precondition$
begin
  if not ((current_database()='zhudatuan_registration' and current_user='shopmigration')
    or coalesce((select rolsuper from pg_roles where rolname=current_user),false)) then
    raise exception 'RUNTIME_CATALOG_ALIGNMENT_CONTEXT_INVALID';
  end if;
  if not exists(select 1 from runtime.schemaversion
      where version='20260904010000'
        and checksum='4fb39b3499024c958f16a5bf15563c56f44506fd25cf92a3efc645b36c9e1bbb')
    or exists(select 1 from runtime.schemaversion where version>'20260904010000') then
    raise exception 'RUNTIME_CATALOG_ALIGNMENT_PREDECESSOR_INVALID';
  end if;
  if not exists(select 1 from access.permission where code='order.read')
    or not exists(select 1 from access.permission where code='payment.create') then
    raise exception 'RUNTIME_CATALOG_ALIGNMENT_PERMISSION_MISSING';
  end if;
end
$precondition$;

insert into runtime.operation(id,owner,method,path,contract_version) values
  ('order.orders.receive','order','POST','/api/v1/orders/{orderid}/receive','1.0.0'),
  ('payment.intents.read','payment','GET','/api/v1/payments/intents/{paymentid}','1.0.0')
on conflict(id) do update set owner=excluded.owner,method=excluded.method,path=excluded.path,contract_version=excluded.contract_version;

insert into capability.capability(id,kind,name,version,status)
select operation.id,'operation',operation.id,1,'active'
from runtime.operation operation
where operation.id in('order.orders.receive','payment.intents.read')
on conflict(id) do update set kind='operation',name=excluded.name,status='active';

insert into capability.operation(operation_id,capability_id,permission_code,audience) values
  ('order.orders.receive','order.orders.receive','order.read','member'),
  ('payment.intents.read','payment.intents.read','payment.create','member')
on conflict(operation_id) do update set capability_id=excluded.capability_id,
  permission_code=excluded.permission_code,audience=excluded.audience;

insert into capability.entitlement(id,scope_id,capability_id,state,quota,effective_at,expires_at,version) values
  ('platform:order.orders.receive','organization-platform-root','order.orders.receive','enabled',null,'1970-01-01T00:00:00Z',null,0),
  ('platform:payment.intents.read','organization-platform-root','payment.intents.read','enabled',null,'1970-01-01T00:00:00Z',null,0)
on conflict(id) do update set capability_id=excluded.capability_id,state='enabled',quota=null,
  effective_at=excluded.effective_at,expires_at=null;

insert into runtime.schemaversion(version,checksum)
values('20260905010000','00b8152be9bdad8f8e3ccf97b2607f33a241e891a32340562a3f2b691023208d');

do $assert$
begin
  if (select count(*) from runtime.operation
      where id in('order.orders.receive','payment.intents.read'))<>2
    or (select count(*) from capability.operation
      where operation_id in('order.orders.receive','payment.intents.read'))<>2
    or (select count(*) from capability.capability
      where id in('order.orders.receive','payment.intents.read') and kind='operation' and status='active')<>2
    or (select count(*) from capability.entitlement
      where capability_id in('order.orders.receive','payment.intents.read')
        and scope_id='organization-platform-root' and state='enabled')<>2
    or not exists(select 1 from runtime.schemaversion
      where version='20260905010000' and checksum='00b8152be9bdad8f8e3ccf97b2607f33a241e891a32340562a3f2b691023208d') then
    raise exception 'RUNTIME_CATALOG_ALIGNMENT_INCOMPLETE';
  end if;
end
$assert$;

commit;
