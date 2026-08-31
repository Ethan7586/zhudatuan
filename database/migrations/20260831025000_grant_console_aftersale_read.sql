begin;

do $precondition$ begin
  if not exists(select 1 from runtime.schemaversion where version='20260831024000') then
    raise exception 'CONSOLE_AFTERSALE_GRANT_PREVIOUS_HEAD_MISSING';
  end if;
  if exists(select 1 from runtime.schemaversion where version='20260831025000') then
    raise exception 'CONSOLE_AFTERSALE_GRANT_ALREADY_APPLIED';
  end if;
end $precondition$;

update capability.operation set audience='public'
where operation_id='order.aftersales.read';

insert into access.rolepermission(role_id,permission_id,effect)
select distinct existing.role_id,aftersale.id,'allow'
from access.rolepermission existing
join access.permission orders on orders.id=existing.permission_id and orders.code='order.read'
join access.permission aftersale on aftersale.code='order.aftersale.read' and aftersale.status='active'
where existing.effect='allow'
on conflict do nothing;

select runtime.record_migration_evidence('20260831025000',1,1,0,0,
  'select operation_id,audience,permission_code from capability.operation where operation_id=''order.aftersales.read'';',
  'select version,checksum from runtime.schemaversion where version=''20260831025000'';');
insert into runtime.schemaversion(version,checksum)
values('20260831025000','5b3a82f7b265f50817668da30b0e389627e1f941cfcba03e1737624fecbe81d8');

do $assert$ begin
  if not exists(select 1 from capability.operation where operation_id='order.aftersales.read' and audience='public') then
    raise exception 'CONSOLE_AFTERSALE_AUDIENCE_MISSING';
  end if;
  if exists(
    select 1 from access.rolepermission existing
    join access.permission orders on orders.id=existing.permission_id and orders.code='order.read'
    where existing.effect='allow' and not exists(
      select 1 from access.rolepermission granted join access.permission aftersale on aftersale.id=granted.permission_id
      where granted.role_id=existing.role_id and granted.effect='allow' and aftersale.code='order.aftersale.read'
    )
  ) then
    raise exception 'CONSOLE_AFTERSALE_PERMISSION_MISSING';
  end if;
end $assert$;

commit;
