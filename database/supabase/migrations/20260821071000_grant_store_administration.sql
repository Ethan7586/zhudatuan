begin;

insert into access.rolepermission(role_id,permission_id,effect)
select 'role-platform-owner-v2',permission.id,'allow'
from access.permission permission
where permission.code in('partner.read','partner.manage')
on conflict do nothing;

insert into runtime.schemaversion(version,checksum)
values('20260821071000','87194d1eaa6aa08eb22932b4eef4134bc58c0457928ab261b325bec432528cd7');

do $assert$ begin
  if not exists(select 1 from access.rolepermission mapping
    join access.permission permission on permission.id=mapping.permission_id and permission.code='partner.manage'
    where mapping.role_id='role-platform-owner-v2' and mapping.effect='allow')
  then raise exception 'PLATFORM_OWNER_STORE_PERMISSION_MISSING'; end if;
end $assert$;

commit;
