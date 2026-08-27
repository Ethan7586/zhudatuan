begin;

delete from access.rolepermission mapping
using access.permission permission
where mapping.role_id='role-platform-owner-v2'
  and mapping.permission_id=permission.id
  and permission.code='voucher.cardlibrary.read'
  and mapping.effect='deny';

insert into access.rolepermission(role_id,permission_id,effect)
select 'role-platform-owner-v2',permission.id,'allow'
from access.permission permission
where permission.code='voucher.cardlibrary.read'
  and permission.status='active'
on conflict do nothing;

insert into runtime.schemaversion(version,checksum)
values('20260821075000','315d7f7a6cb2a2e9e3c327dcced2a277005a9d7d88d44f566cbfe58ed95495ef');

do $assert$ begin
  if not exists(
    select 1
    from capability.membership_operations('membership-platform-owner-ethan-v1') available
    where available.operation_id='voucher.cardlibraries.read'
  ) then
    raise exception 'PLATFORM_OWNER_CARDLIBRARY_READ_MISSING';
  end if;
end $assert$;

commit;
