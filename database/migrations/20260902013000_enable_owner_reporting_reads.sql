begin;

do $precondition$
declare
  required_operations constant text[] := array[
    'reporting.products.read',
    'reporting.malls.read',
    'reporting.categories.read',
    'reporting.channels.read',
    'reporting.powderclass.read',
    'reporting.voucherconsumption.read'
  ];
begin
  if not exists(select 1 from runtime.schemaversion where version='20260902012000') then
    raise exception 'OWNER_REPORTING_READS_PREVIOUS_HEAD_MISSING';
  end if;
  if exists(select 1 from runtime.schemaversion where version='20260902013000') then
    raise exception 'OWNER_REPORTING_READS_ALREADY_APPLIED';
  end if;
  if exists(
    select 1
    from unnest(required_operations) required(operation_id)
    where not exists(
      select 1
      from capability.operation binding
      join access.permission permission on permission.code=binding.permission_code
      join capability.entitlement entitlement on entitlement.capability_id=binding.capability_id
      where binding.operation_id=required.operation_id
        and binding.audience='console'
        and permission.risk='low'
        and permission.status='active'
        and entitlement.scope_id='organization-platform-root'
        and entitlement.state='enabled'
        and entitlement.effective_at<=clock_timestamp()
        and (entitlement.expires_at is null or entitlement.expires_at>clock_timestamp())
    )
  ) then
    raise exception 'OWNER_REPORTING_READS_CONTRACT_MISSING';
  end if;
end
$precondition$;

with required_permission(code) as (values
  ('reporting.product.read'),
  ('reporting.mall.read'),
  ('reporting.category.read'),
  ('reporting.channel.read'),
  ('reporting.powderclass.read'),
  ('reporting.voucher.read')
)
delete from access.rolepermission mapping
using access.role role,access.permission permission,required_permission required
where mapping.role_id=role.id
  and mapping.permission_id=permission.id
  and permission.code=required.code
  and role.kind='owner'
  and role.status='active'
  and mapping.effect='deny';

with required_permission(code) as (values
  ('reporting.product.read'),
  ('reporting.mall.read'),
  ('reporting.category.read'),
  ('reporting.channel.read'),
  ('reporting.powderclass.read'),
  ('reporting.voucher.read')
)
insert into access.rolepermission(role_id,permission_id,effect)
select role.id,permission.id,'allow'
from access.role role
cross join required_permission required
join access.permission permission on permission.code=required.code and permission.status='active'
where role.kind='owner' and role.status='active'
on conflict do nothing;

select runtime.record_migration_evidence(
  '20260902013000',6,6,0,0,
  'select role.id,permission.code,mapping.effect from access.role role join access.rolepermission mapping on mapping.role_id=role.id join access.permission permission on permission.id=mapping.permission_id where role.kind=''owner'' and permission.code like ''reporting.%'' order by role.id,permission.code;',
  'select membership.id,available.operation_id from access.membership membership join lateral capability.membership_operations(membership.id) available on available.operation_id like ''reporting.%'' where membership.status=''active'' order by membership.id,available.operation_id;'
);

insert into runtime.schemaversion(version,checksum)
values(
  '20260902013000',
  encode(public.digest('20260902013000_enable_owner_reporting_reads','sha256'),'hex')
);

do $assert$
declare
  required_operations constant text[] := array[
    'reporting.products.read',
    'reporting.malls.read',
    'reporting.categories.read',
    'reporting.channels.read',
    'reporting.powderclass.read',
    'reporting.voucherconsumption.read'
  ];
begin
  if exists(
    select 1
    from access.membership membership
    cross join unnest(required_operations) required(operation_id)
    where membership.status='active'
      and exists(
        select 1
        from access.membershiprole assignment
        join access.role role on role.id=assignment.role_id
        where assignment.membership_id=membership.id
          and role.kind='owner'
          and role.status='active'
          and assignment.effective_at<=clock_timestamp()
          and (assignment.expires_at is null or assignment.expires_at>clock_timestamp())
      )
      and exists(
        select 1 from capability.membership_operations(membership.id) available
        where available.operation_id='reporting.sales.read'
      )
      and not exists(
        select 1 from capability.membership_operations(membership.id) available
        where available.operation_id=required.operation_id
      )
  ) then
    raise exception 'OWNER_REPORTING_READS_CLOSURE_INVALID';
  end if;
end
$assert$;

commit;
