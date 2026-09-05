begin;

do $assert$
begin
  if not exists(
    select 1 from access.role
    where id='role-l1-owner-v1:tenant-zhudatuan'
      and scope_id='tenant-zhudatuan' and name='L1 Owner' and status='active'
  ) then
    raise exception 'L1_OWNER_ROLE_INVALID';
  end if;

  if exists(
    (select mapping.permission_id,mapping.effect
      from access.rolepermission mapping
      join access.permission permission on permission.id=mapping.permission_id
      where mapping.role_id='role-platform-owner-v2'
        and mapping.effect='allow' and permission.code not like 'access.ownership.%')
    except
    (select mapping.permission_id,mapping.effect
      from access.rolepermission mapping
      where mapping.role_id='role-l1-owner-v1:tenant-zhudatuan')
  ) or exists(
    (select mapping.permission_id,mapping.effect
      from access.rolepermission mapping
      where mapping.role_id='role-l1-owner-v1:tenant-zhudatuan')
    except
    (select mapping.permission_id,mapping.effect
      from access.rolepermission mapping
      join access.permission permission on permission.id=mapping.permission_id
      where mapping.role_id='role-platform-owner-v2'
        and mapping.effect='allow' and permission.code not like 'access.ownership.%')
  ) then
    raise exception 'L1_OWNER_PERMISSION_SET_INVALID';
  end if;

  if exists(
    select 1
    from access.mallowner owner
    join access.membership membership on membership.id=owner.membership_id and membership.status='active'
    join organization.unitclosure closure on closure.ancestor_id='tenant-zhudatuan'
      and closure.descendant_id=owner.organization_id
    where not exists(
      select 1 from access.membershiprole assignment
      where assignment.membership_id=owner.membership_id
        and assignment.role_id='role-l1-owner-v1:tenant-zhudatuan'
        and assignment.assigned_scope_kind='mall'
        and assignment.assigned_scope_id=owner.scope_id
        and assignment.scope_source='l1_owner'
        and assignment.effective_at<=clock_timestamp()
        and (assignment.expires_at is null or assignment.expires_at>clock_timestamp())
    )
  ) then
    raise exception 'L1_OWNER_SCOPE_ASSIGNMENT_INVALID';
  end if;

  if exists(
    select 1 from organization.organization organization
    join organization.unitclosure closure on closure.ancestor_id='tenant-zhudatuan'
      and closure.descendant_id=organization.id
    where organization.kind='mall' and organization.status='active'
      and access.scope_object(organization.id)->>'name' is distinct from organization.name
  ) then
    raise exception 'L1_BRAND_NAME_PROJECTION_INVALID';
  end if;

  if not exists(
    select 1 from runtime.schemaversion
    where version='20260905014000'
      and checksum='53560f22d8233a2ff089cdf6588c7ec710fbe9764f3e4edc81ca175c0b23cf70'
  ) or exists(
    select 1 from runtime.schemaversion where version>'20260905014000'
  ) then
    raise exception 'L1_OWNER_RUNTIME_PREDECESSOR_INVALID';
  end if;
end
$assert$;

insert into runtime.schemaversion(version,checksum)
values('20260906011000','61e0eeb3593192e5e75b9ff4bf4df82678521d2d01f7e7d4177b56106ef5b51c');

do $assert$
begin
  if not exists(
    select 1 from runtime.schemaversion
    where version='20260906011000'
      and checksum='61e0eeb3593192e5e75b9ff4bf4df82678521d2d01f7e7d4177b56106ef5b51c'
  ) then
    raise exception 'L1_OWNER_RUNTIME_HEAD_INVALID';
  end if;
end
$assert$;

commit;
