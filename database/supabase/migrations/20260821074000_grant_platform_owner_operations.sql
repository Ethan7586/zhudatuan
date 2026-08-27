begin;

-- The platform owner predates the hard-cut Console Operation catalog. Later
-- repair migrations registered the 21 workstation reads without extending the
-- canonical owner role, which made the whole Console disappear behind the
-- permission + capability gates. Grant only the explicit read gates here;
-- each workstation's writes remain separately permissioned and tested.
with required_permission(code) as (values
  ('organization.layer.read'),
  ('channel.distributor.read'),
  ('channel.connection.read'),
  ('reporting.dashboard.read'),
  ('experience.application.read'),
  ('catalog.pool.read'),
  ('order.read'),
  ('voucher.binding.read'),
  ('finance.overview.read'),
  ('reporting.sales.read'),
  ('support.case.read'),
  ('access.center.read')
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
  and permission.code in(
    'organization.layer.read',
    'channel.distributor.read',
    'channel.connection.read',
    'reporting.dashboard.read',
    'experience.application.read',
    'catalog.pool.read',
    'order.read',
    'voucher.binding.read',
    'finance.overview.read',
    'reporting.sales.read',
    'support.case.read',
    'access.center.read'
  )
on conflict do nothing;

insert into runtime.schemaversion(version,checksum)
values('20260821074000','c4e1cfd73e9ad59f2424e650a30b57b672381ac35d1fe40ce7811b427cadb367');

do $assert$
declare
  required_permissions constant text[] := array[
    'organization.layer.read',
    'channel.distributor.read',
    'channel.connection.read',
    'reporting.dashboard.read',
    'experience.application.read',
    'catalog.pool.read',
    'order.read',
    'voucher.binding.read',
    'finance.overview.read',
    'reporting.sales.read',
    'support.case.read',
    'access.center.read'
  ];
  required_operations constant text[] := array[
    'organization.layers.read',
    'channel.distributors.read',
    'channel.connections.read',
    'reporting.dashboard.read',
    'experience.applications.read',
    'catalog.pools.read',
    'order.orders.read',
    'voucher.bindings.read',
    'finance.overview.read',
    'reporting.sales.read',
    'support.cases.read',
    'access.center.read'
  ];
begin
  if exists(
    select 1
    from unnest(required_permissions) required(code)
    where not exists(
        select 1
        from access.rolepermission mapping
        join access.permission permission on permission.id=mapping.permission_id
        where mapping.role_id='role-platform-owner-v2'
          and permission.code=required.code
          and mapping.effect='allow'
      )
  ) then
    raise exception 'PLATFORM_OWNER_OPERATION_PERMISSION_MISSING';
  end if;

  if exists(
    select 1
    from unnest(required_operations) required(operation_id)
    where not exists(
      select 1
      from capability.membership_operations('membership-platform-owner-ethan-v1') available
      where available.operation_id=required.operation_id
    )
  ) then
    raise exception 'PLATFORM_OWNER_CONSOLE_OPERATION_MISSING';
  end if;
end
$assert$;

commit;
