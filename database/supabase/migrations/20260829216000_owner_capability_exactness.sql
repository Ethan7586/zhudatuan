begin;

select pg_advisory_xact_lock(hashtext('zhudatuan:owner-capability-exactness:v1'));

do $boundary_guard$
declare current_checksum text;
begin
  if not (
    (current_database()='zhudatuan_registration' and current_user='shopmigration')
    or coalesce((select rolsuper from pg_roles where rolname=current_user),false)
  ) then
    raise exception 'OWNER_CAPABILITY_EXACTNESS_BOUNDARY_INVALID';
  end if;
  if not exists(select 1 from runtime.schemaversion
    where version='20260829215000'
      and checksum='f47932300e00238c3aa4a2ef25b237d5a409aa72ece9e960297b8e5b33176a42') then
    raise exception 'OWNER_CAPABILITY_EXACTNESS_PREDECESSOR_INVALID';
  end if;
  if exists(select 1 from runtime.schemaversion where version>'20260829215000') then
    raise exception 'OWNER_CAPABILITY_EXACTNESS_FUTURE_HEAD_INVALID';
  end if;

  select checksum into current_checksum from runtime.schemaversion where version='20260821032000';
  if current_checksum is distinct from '3d361b63c55c8500daf4a35aaa208f13a2739e485d772cd83d4129d09fe2c144' then
    raise exception 'OWNER_CAPABILITY_EXACTNESS_CONTRACT_INVALID:%',coalesce(current_checksum,'missing');
  end if;
end
$boundary_guard$;

-- Public operations are reachable without a membership capability.  They stay
-- in the capability catalog, but are not permanent entitlements of the Owner.
delete from capability.entitlement entitlement
where entitlement.scope_id='organization-platform-root'
  and entitlement.state='enabled'
  and entitlement.effective_at='1970-01-01T00:00:00Z'
  and entitlement.expires_at is null
  and not exists(
    select 1
    from capability.operation operation
    join capability.capability capability
      on capability.id=operation.capability_id and capability.status='active'
    where operation.capability_id=entitlement.capability_id
      and operation.audience<>'public'
  );

create or replace function access.enforce_platform_owner_operator_coverage()
returns trigger
language plpgsql
security definer
set search_path=pg_catalog,pg_temp
as $function$
begin
  if not exists(select 1 from access.role
    where id='role-platform-owner-v2' and scope_id='tenant-zhudatuan' and status='active') then
    raise exception 'PLATFORM_OWNER_ROLE_INVALID';
  end if;

  if exists(
    select 1
    from capability.operation operation
    left join capability.capability capability on capability.id=operation.capability_id
    left join access.permission permission on permission.code=operation.permission_code
    where operation.audience='operator'
      and (
        capability.id is null or capability.status<>'active'
        or operation.permission_code is null
        or permission.id is null or permission.status<>'active'
      )
  ) then
    raise exception 'OWNER_OPERATOR_CATALOG_INVALID';
  end if;

  if exists(
    with expected(code) as (
      select distinct permission.code
      from capability.operation operation
      join capability.capability capability
        on capability.id=operation.capability_id and capability.status='active'
      join access.permission permission
        on permission.code=operation.permission_code and permission.status='active'
      where operation.audience<>'public'
    ), actual(code) as (
      select permission.code
      from access.rolepermission mapping
      join access.permission permission on permission.id=mapping.permission_id
      where mapping.role_id='role-platform-owner-v2' and mapping.effect='allow'
    ), drift(code) as (
      (select code from expected except select code from actual)
      union all
      (select code from actual except select code from expected)
    )
    select 1 from drift
  ) or exists(select 1 from access.rolepermission
    where role_id='role-platform-owner-v2' and effect='deny') then
    raise exception 'PLATFORM_OWNER_OPERATOR_PERMISSION_DRIFT';
  end if;

  if exists(
    with expected(capability_id) as (
      select distinct operation.capability_id
      from capability.operation operation
      join capability.capability capability
        on capability.id=operation.capability_id and capability.status='active'
      where operation.audience<>'public'
    ), actual(capability_id) as (
      select entitlement.capability_id
      from capability.entitlement entitlement
      where entitlement.scope_id='organization-platform-root'
        and entitlement.state='enabled'
        and entitlement.effective_at='1970-01-01T00:00:00Z'
        and entitlement.expires_at is null
    ), drift(capability_id) as (
      (select capability_id from expected except select capability_id from actual)
      union all
      (select capability_id from actual except select capability_id from expected)
    )
    select 1 from drift
  ) then
    raise exception 'PLATFORM_OWNER_OPERATOR_ENTITLEMENT_DRIFT';
  end if;

  if to_regclass('access.platformowner') is not null then
    if exists(select 1 from access.platformowner where singleton=true and state='active') and (
      exists(
        with owner as (
          select membership_id from access.platformowner where singleton=true and state='active'
        ), expected(code) as (
          select distinct permission.code
          from capability.operation operation
          join capability.capability capability
            on capability.id=operation.capability_id and capability.status='active'
          join access.permission permission
            on permission.code=operation.permission_code and permission.status='active'
          where operation.audience<>'public'
        )
        select 1 from owner
        cross join lateral access.resolve_membership(owner.membership_id) resolved
        join expected on expected.code=any(resolved.denies)
      )
      or exists(
        with owner as (
          select membership_id from access.platformowner where singleton=true and state='active'
        ), expected(operation_id) as (
          select operation.operation_id
          from capability.operation operation
          join capability.capability capability
            on capability.id=operation.capability_id and capability.status='active'
          join access.permission permission
            on permission.code=operation.permission_code and permission.status='active'
          where operation.audience<>'public'
        )
        select operation_id from expected
        except
        select available.operation_id from owner
        cross join lateral capability.membership_operations(owner.membership_id) available
      )
    ) then
      raise exception 'PLATFORM_OWNER_RESOLVED_COVERAGE_DRIFT';
    end if;
  end if;

  return null;
end
$function$;

revoke all on function access.enforce_platform_owner_operator_coverage() from public;

-- The six existing constraint triggers retain this function OID.  Force their
-- deferred validation now so this migration cannot commit a partial exact set.
update access.role set status=status where id='role-platform-owner-v2';
set constraints all immediate;
set constraints all deferred;

insert into runtime.schemaversion(version,checksum)
values('20260829216000','da02c3f15cd8fb8914a0d8a055ee6b23bf9f563c434ff72044aea8f07e23868b');

do $assert$
begin
  if exists(
    with expected(capability_id) as (
      select distinct operation.capability_id
      from capability.operation operation
      join capability.capability capability
        on capability.id=operation.capability_id and capability.status='active'
      where operation.audience<>'public'
    ), actual(capability_id) as (
      select entitlement.capability_id
      from capability.entitlement entitlement
      where entitlement.scope_id='organization-platform-root'
        and entitlement.state='enabled'
        and entitlement.effective_at='1970-01-01T00:00:00Z'
        and entitlement.expires_at is null
    ), drift(capability_id) as (
      (select capability_id from expected except select capability_id from actual)
      union all
      (select capability_id from actual except select capability_id from expected)
    )
    select 1 from drift
  ) then
    raise exception 'OWNER_CAPABILITY_EXACTNESS_INVALID';
  end if;
  if not exists(select 1 from capability.operation where audience='public') then
    raise exception 'PUBLIC_OPERATION_CATALOG_INVALID';
  end if;
  if not exists(select 1 from runtime.schemaversion
    where version='20260829216000'
      and checksum='da02c3f15cd8fb8914a0d8a055ee6b23bf9f563c434ff72044aea8f07e23868b') then
    raise exception 'OWNER_CAPABILITY_EXACTNESS_SCHEMA_VERSION_INVALID';
  end if;
end
$assert$;

commit;
