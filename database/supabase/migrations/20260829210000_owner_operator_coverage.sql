begin;

select pg_advisory_xact_lock(hashtext('zhudatuan:owner-operator-coverage:v1'));

do $boundary_guard$
begin
  if not (
    (current_database()='zhudatuan_registration' and current_user='shopmigration')
    or coalesce((select rolsuper from pg_roles where rolname=current_user),false)
  ) then
    raise exception 'OWNER_OPERATOR_COVERAGE_BOUNDARY_INVALID';
  end if;
  if not exists(select 1 from runtime.schemaversion
    where version='20260829054500'
      and checksum='624ce2aff8edc85f82d71d09db019b623199eeb4522017dca3f9d44ba3803df9') then
    raise exception 'OWNER_OPERATOR_COVERAGE_PREDECESSOR_INVALID';
  end if;
  if exists(select 1 from runtime.schemaversion
    where version='20260829060000'
      and checksum<>'b1e238eb8de569b0de9d1d2766620e1f661268d2f9260e646208d4f24715b37a') then
    raise exception 'OWNER_OPERATOR_COVERAGE_OPTIONAL_PREDECESSOR_INVALID';
  end if;
  if exists(select 1 from runtime.schemaversion
    where version>'20260829054500'
      and version not in('20260829060000','20260829210000')) then
    raise exception 'OWNER_OPERATOR_COVERAGE_FUTURE_HEAD_INVALID';
  end if;
  if not exists(select 1 from access.role
    where id='role-platform-owner-v2' and scope_id='tenant-zhudatuan' and status='active') then
    raise exception 'PLATFORM_OWNER_ROLE_INVALID';
  end if;
end
$boundary_guard$;

-- An Operator operation is executable only when its capability and permission
-- are both active. Refuse an internally inconsistent catalog instead of
-- silently turning a broken operation into an Owner permission omission.
do $catalog_guard$
begin
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
end
$catalog_guard$;

-- The platform Owner is an exact projection of every non-public operation, which
-- is the same surface capability.membership_operations exposes to a console
-- session.  Restricting the projection to audience='operator' would strip the
-- member-audience console reads (catalog listings, inventory availability,
-- orders, voucher bindings) that the registration baseline asserts the Owner
-- must retain.  No stale grants, no missing grants and no deny overlay.
delete from access.rolepermission mapping
where mapping.role_id='role-platform-owner-v2'
  and (
    mapping.effect<>'allow'
    or not exists(
      select 1
      from capability.operation operation
      join capability.capability capability
        on capability.id=operation.capability_id and capability.status='active'
      join access.permission permission
        on permission.code=operation.permission_code and permission.status='active'
      where operation.audience<>'public'
        and permission.id=mapping.permission_id
    )
  );

insert into access.rolepermission(role_id,permission_id,effect)
select distinct 'role-platform-owner-v2',permission.id,'allow'
from capability.operation operation
join capability.capability capability
  on capability.id=operation.capability_id and capability.status='active'
join access.permission permission
  on permission.code=operation.permission_code and permission.status='active'
where operation.audience<>'public'
on conflict do nothing;

-- Every Operator capability has a non-expiring platform-root entitlement.
-- Existing historical entitlements are retained; the epoch row is the stable,
-- canonical grant used by the coverage invariant.
insert into capability.entitlement(
  id,scope_id,capability_id,state,quota,effective_at,expires_at,version
)
select
  'platform:'||operation.capability_id,
  'organization-platform-root',
  operation.capability_id,
  'enabled',
  null,
  '1970-01-01T00:00:00Z',
  null,
  0
from capability.operation operation
join capability.capability capability
  on capability.id=operation.capability_id and capability.status='active'
where operation.audience<>'public'
on conflict(scope_id,capability_id,effective_at) do update
set state='enabled',quota=null,expires_at=null,version=capability.entitlement.version+1
where capability.entitlement.state<>'enabled'
  or capability.entitlement.quota is not null
  or capability.entitlement.expires_at is not null;

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
    select operation.capability_id
    from capability.operation operation
    join capability.capability capability
      on capability.id=operation.capability_id and capability.status='active'
    where operation.audience<>'public'
    except
    select entitlement.capability_id
    from capability.entitlement entitlement
    where entitlement.scope_id='organization-platform-root'
      and entitlement.state='enabled'
      and entitlement.effective_at='1970-01-01T00:00:00Z'
      and entitlement.expires_at is null
  ) then
    raise exception 'PLATFORM_OWNER_OPERATOR_ENTITLEMENT_DRIFT';
  end if;

  -- Once the dynamic singleton exists (introduced by the transfer migration), validate the
  -- effective Owner rather than only the Owner role definition.  In particular, role:self or
  -- another overlay must not silently deny an Operator permission or remove an executable
  -- Operator operation.
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

create constraint trigger platform_owner_operator_coverage_permission
after insert or update or delete on access.permission
deferrable initially deferred
for each row execute function access.enforce_platform_owner_operator_coverage();

create constraint trigger platform_owner_operator_coverage_role
after insert or update or delete on access.role
deferrable initially deferred
for each row execute function access.enforce_platform_owner_operator_coverage();

create constraint trigger platform_owner_operator_coverage_rolepermission
after insert or update or delete on access.rolepermission
deferrable initially deferred
for each row execute function access.enforce_platform_owner_operator_coverage();

create constraint trigger platform_owner_operator_coverage_capability
after insert or update or delete on capability.capability
deferrable initially deferred
for each row execute function access.enforce_platform_owner_operator_coverage();

create constraint trigger platform_owner_operator_coverage_entitlement
after insert or update or delete on capability.entitlement
deferrable initially deferred
for each row execute function access.enforce_platform_owner_operator_coverage();

create constraint trigger platform_owner_operator_coverage_operation
after insert or update or delete on capability.operation
deferrable initially deferred
for each row execute function access.enforce_platform_owner_operator_coverage();

-- Queue one deferred check after the reconciliation above, then force it now.
-- Subsequent migrations retain INITIALLY DEFERRED semantics so catalog,
-- permission, role and entitlement rows may be changed in any order inside one
-- atomic transaction, while an incomplete final state still cannot commit.
update access.role set status=status where id='role-platform-owner-v2';
set constraints all immediate;
set constraints all deferred;

insert into runtime.schemaversion(version,checksum)
values('20260829210000','7a5e2d2cb2e3682674a3d8a7ac52177ba0f6ee93588bd9a7f489d4c405a4d222')
on conflict(version) do nothing;

do $assert$
begin
  if not exists(select 1 from runtime.schemaversion
    where version='20260829210000'
      and checksum='7a5e2d2cb2e3682674a3d8a7ac52177ba0f6ee93588bd9a7f489d4c405a4d222') then
    raise exception 'OWNER_OPERATOR_COVERAGE_SCHEMA_VERSION_INVALID';
  end if;
  if (select count(*) from pg_trigger trigger
      join pg_class relation on relation.oid=trigger.tgrelid
      join pg_namespace namespace on namespace.oid=relation.relnamespace
      where not trigger.tgisinternal and trigger.tgdeferrable and trigger.tginitdeferred
        and trigger.tgname like 'platform_owner_operator_coverage_%'
        and namespace.nspname||'.'||relation.relname in(
          'access.permission','access.role','access.rolepermission',
          'capability.capability','capability.entitlement','capability.operation'
        ))<>6 then
    raise exception 'OWNER_OPERATOR_COVERAGE_TRIGGER_INVALID';
  end if;
end
$assert$;

commit;
