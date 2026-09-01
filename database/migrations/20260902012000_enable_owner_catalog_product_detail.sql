begin;

do $precondition$
begin
  if not exists(select 1 from runtime.schemaversion where version='20260902011000') then
    raise exception 'OWNER_CATALOG_PRODUCT_DETAIL_PREVIOUS_HEAD_MISSING';
  end if;
  if exists(select 1 from runtime.schemaversion where version='20260902012000') then
    raise exception 'OWNER_CATALOG_PRODUCT_DETAIL_ALREADY_APPLIED';
  end if;
  if not exists(
    select 1
    from capability.operation binding
    join capability.entitlement entitlement on entitlement.capability_id=binding.capability_id
    join access.permission permission on permission.code=binding.permission_code
    where binding.operation_id='catalog.product.detail.read'
      and binding.permission_code='catalog.product.read'
      and binding.audience='console'
      and entitlement.id='platform:catalog.product.detail.read'
      and entitlement.scope_id='organization-platform-root'
      and entitlement.state='enabled'
      and permission.risk='low'
      and permission.status='active'
  ) then
    raise exception 'OWNER_CATALOG_PRODUCT_DETAIL_CONTRACT_MISSING';
  end if;
end
$precondition$;

delete from access.rolepermission mapping
using access.role role,access.permission permission
where mapping.role_id=role.id
  and mapping.permission_id=permission.id
  and role.kind='owner'
  and role.status='active'
  and permission.code='catalog.product.read'
  and mapping.effect='deny';

insert into access.rolepermission(role_id,permission_id,effect)
select role.id,permission.id,'allow'
from access.role role
cross join access.permission permission
where role.kind='owner'
  and role.status='active'
  and permission.code='catalog.product.read'
  and permission.status='active'
on conflict do nothing;

select runtime.record_migration_evidence(
  '20260902012000',1,1,0,0,
  'select role.id,permission.code,mapping.effect from access.role role join access.rolepermission mapping on mapping.role_id=role.id join access.permission permission on permission.id=mapping.permission_id where role.kind=''owner'' and permission.code=''catalog.product.read'';',
  'select membership.id from access.membership membership where exists(select 1 from capability.membership_operations(membership.id) available where available.operation_id=''catalog.listings.read'') and not exists(select 1 from capability.membership_operations(membership.id) available where available.operation_id=''catalog.product.detail.read'');'
);

insert into runtime.schemaversion(version,checksum)
values(
  '20260902012000',
  encode(public.digest('20260902012000_enable_owner_catalog_product_detail','sha256'),'hex')
);

do $assert$
begin
  if exists(
    select 1
    from access.role role
    where role.kind='owner'
      and role.status='active'
      and not exists(
        select 1
        from access.rolepermission mapping
        join access.permission permission on permission.id=mapping.permission_id
        where mapping.role_id=role.id
          and permission.code='catalog.product.read'
          and mapping.effect='allow'
      )
  ) then
    raise exception 'OWNER_CATALOG_PRODUCT_DETAIL_PERMISSION_MISSING';
  end if;

  if exists(
    select 1
    from access.membership membership
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
        where available.operation_id='catalog.listings.read'
      )
      and not exists(
        select 1 from capability.membership_operations(membership.id) available
        where available.operation_id='catalog.product.detail.read'
      )
  ) then
    raise exception 'OWNER_CATALOG_PRODUCT_DETAIL_CLOSURE_INVALID';
  end if;
end
$assert$;

commit;
