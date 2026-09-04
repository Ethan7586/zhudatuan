begin;

-- The Shop cockpit joins the listing and availability read models to the
-- reporting dashboard. Keep this grant deliberately read-only: publication,
-- stock adjustment and every other catalogue mutation remain unavailable.
with required_permission(code) as (values
  ('catalog.listing.read'),
  ('inventory.read')
), executable_permission as (
  select permission.id
  from required_permission required
  join access.permission permission on permission.code=required.code and permission.status='active'
)
delete from access.rolepermission mapping
using executable_permission permission
where mapping.role_id='role-platform-owner-v2'
  and mapping.permission_id=permission.id
  and mapping.effect='deny';

insert into access.rolepermission(role_id,permission_id,effect)
select 'role-platform-owner-v2',permission.id,'allow'
from access.permission permission
where permission.status='active'
  and permission.code in('catalog.listing.read','inventory.read')
on conflict do nothing;

insert into runtime.schemaversion(version,checksum)
values('20260821076000','658762fb070632c09406cc8a9c82f1f3d661208b4e7dd8e296246473b1831ac3');

do $assert$
declare
  required_operations constant text[] := array[
    'catalog.listings.read',
    'inventory.availability.read'
  ];
begin
  if exists(
    select 1
    from unnest(required_operations) required(operation_id)
    where not exists(
      select 1
      from capability.membership_operations('membership-platform-owner-ethan-v1') available
      where available.operation_id=required.operation_id
    )
  ) then
    raise exception 'PLATFORM_OWNER_COCKPIT_READ_MISSING';
  end if;
end
$assert$;

commit;
