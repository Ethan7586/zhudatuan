begin;

select pg_advisory_xact_lock(hashtext('zhudatuan:registration-boundary-reconcile:v1'));

do $guard$
declare
  bootstrap_boundary oid := to_regprocedure('deployment.registration_bootstrap_boundary(text)');
  migration_boundary oid := to_regprocedure('deployment.is_independent_registration_database()');
  bootstrap_definition text;
  migration_definition text;
begin
  if current_database()<>'zhudatuan_registration'
    or not coalesce((select rolsuper from pg_roles where rolname=current_user),false) then
    raise exception 'ZHUDATUAN_REGISTRATION_BOUNDARY_RECONCILE_AUTHORITY_INVALID';
  end if;
  if bootstrap_boundary is null or migration_boundary is null then
    raise exception 'ZHUDATUAN_REGISTRATION_BOUNDARY_FUNCTION_MISSING';
  end if;
  if not exists(select 1 from deployment.boundary
    where id='zhudatuan-registration-v1' and database_name=current_database()) then
    raise exception 'ZHUDATUAN_REGISTRATION_BOUNDARY_SENTINEL_MISSING';
  end if;
  if exists(select 1 from pg_roles where rolname in('zhudatuanbootstrap','shopmigration')
    and (rolsuper or rolcreatedb or rolcreaterole or rolinherit or rolreplication or rolbypassrls))
    or (select count(*) from pg_roles where rolname in('zhudatuanbootstrap','shopmigration'))<>2 then
    raise exception 'ZHUDATUAN_REGISTRATION_BOUNDARY_ROLE_INVALID';
  end if;

  if not exists(select 1 from pg_proc function
    join pg_roles owner on owner.oid=function.proowner
    where function.oid=bootstrap_boundary
      and owner.rolsuper
      and function.prosecdef
      and function.provolatile='s'
      and function.prorettype='boolean'::regtype
      and exists(select 1 from unnest(function.proconfig) setting
        where regexp_replace(setting,'\s','','g')='search_path=pg_catalog,deployment,public')) then
    raise exception 'ZHUDATUAN_REGISTRATION_BOOTSTRAP_BOUNDARY_CONTRACT_INVALID';
  end if;
  select lower(pg_get_functiondef(bootstrap_boundary)) into bootstrap_definition;
  if bootstrap_definition !~ $pattern$session_user\s*=\s*'zhudatuanbootstrap'$pattern$
    or bootstrap_definition !~ $pattern$current_database\(\)\s*=\s*'zhudatuan_registration'$pattern$
    or bootstrap_definition !~ $pattern$id\s*=\s*'zhudatuan-registration-v1'$pattern$
    or bootstrap_definition !~ $pattern$sentinel_hash\s*=\s*encode\s*\(\s*public\.digest$pattern$ then
    raise exception 'ZHUDATUAN_REGISTRATION_BOOTSTRAP_BOUNDARY_DEFINITION_DRIFT';
  end if;

  if not exists(select 1 from pg_proc function
    join pg_roles owner on owner.oid=function.proowner
    where function.oid=migration_boundary
      and owner.rolsuper
      and function.prosecdef
      and function.provolatile='s'
      and function.prorettype='boolean'::regtype
      and exists(select 1 from unnest(function.proconfig) setting
        where regexp_replace(setting,'\s','','g')='search_path=pg_catalog,deployment')) then
    raise exception 'ZHUDATUAN_REGISTRATION_MIGRATION_BOUNDARY_CONTRACT_INVALID';
  end if;
  select lower(pg_get_functiondef(migration_boundary)) into migration_definition;
  if migration_definition !~ $pattern$current_database\(\)\s*=\s*'zhudatuan_registration'$pattern$
    or migration_definition !~ $pattern$id\s*=\s*'zhudatuan-registration-v1'$pattern$ then
    raise exception 'ZHUDATUAN_REGISTRATION_MIGRATION_BOUNDARY_DEFINITION_DRIFT';
  end if;
end
$guard$;

revoke all on function deployment.registration_bootstrap_boundary(text) from public;
do $revoke_unexpected$
declare grantee_name text;
begin
  for grantee_name in
    select distinct grantee.rolname
    from pg_proc function
    cross join lateral aclexplode(coalesce(function.proacl,acldefault('f',function.proowner))) privilege
    join pg_roles grantee on grantee.oid=privilege.grantee
    where function.oid=to_regprocedure('deployment.registration_bootstrap_boundary(text)')
      and grantee.oid<>function.proowner
      and grantee.rolname not in('zhudatuanbootstrap','shopmigration')
  loop
    execute format('revoke all on function deployment.registration_bootstrap_boundary(text) from %I',grantee_name);
  end loop;
  for grantee_name in
    select distinct grantee.rolname
    from pg_proc function
    cross join lateral aclexplode(coalesce(function.proacl,acldefault('f',function.proowner))) privilege
    join pg_roles grantee on grantee.oid=privilege.grantee
    where function.oid=to_regprocedure('deployment.is_independent_registration_database()')
      and grantee.oid<>function.proowner
      and grantee.rolname<>'shopmigration'
  loop
    execute format('revoke all on function deployment.is_independent_registration_database() from %I',grantee_name);
  end loop;
end
$revoke_unexpected$;
revoke all on function deployment.is_independent_registration_database() from public;
grant usage on schema deployment to zhudatuanbootstrap,shopmigration;
grant execute on function deployment.registration_bootstrap_boundary(text) to zhudatuanbootstrap,shopmigration;
grant execute on function deployment.is_independent_registration_database() to shopmigration;

do $assert$
begin
  if not has_function_privilege('zhudatuanbootstrap','deployment.registration_bootstrap_boundary(text)','EXECUTE')
    or not has_function_privilege('shopmigration','deployment.registration_bootstrap_boundary(text)','EXECUTE')
    or not has_function_privilege('shopmigration','deployment.is_independent_registration_database()','EXECUTE') then
    raise exception 'ZHUDATUAN_REGISTRATION_BOUNDARY_RECONCILE_FAILED';
  end if;
  if exists(
    select 1 from pg_proc function
    cross join lateral aclexplode(coalesce(function.proacl,acldefault('f',function.proowner))) privilege
    left join pg_roles grantee on grantee.oid=privilege.grantee
    where function.oid=to_regprocedure('deployment.registration_bootstrap_boundary(text)')
      and (
        privilege.privilege_type<>'EXECUTE'
        or privilege.grantee=0
        or (privilege.grantee<>function.proowner and grantee.rolname not in('zhudatuanbootstrap','shopmigration'))
        or (privilege.grantee<>function.proowner and privilege.is_grantable)
      )
  ) or (select count(distinct privilege.grantee)
    from pg_proc function
    cross join lateral aclexplode(coalesce(function.proacl,acldefault('f',function.proowner))) privilege
    where function.oid=to_regprocedure('deployment.registration_bootstrap_boundary(text)')
      and privilege.privilege_type='EXECUTE')<>3 then
    raise exception 'ZHUDATUAN_REGISTRATION_BOOTSTRAP_BOUNDARY_ACL_DRIFT';
  end if;
  if exists(
    select 1 from pg_proc function
    cross join lateral aclexplode(coalesce(function.proacl,acldefault('f',function.proowner))) privilege
    left join pg_roles grantee on grantee.oid=privilege.grantee
    where function.oid=to_regprocedure('deployment.is_independent_registration_database()')
      and (
        privilege.privilege_type<>'EXECUTE'
        or privilege.grantee=0
        or (privilege.grantee<>function.proowner and grantee.rolname<>'shopmigration')
        or (privilege.grantee<>function.proowner and privilege.is_grantable)
      )
  ) or (select count(distinct privilege.grantee)
    from pg_proc function
    cross join lateral aclexplode(coalesce(function.proacl,acldefault('f',function.proowner))) privilege
    where function.oid=to_regprocedure('deployment.is_independent_registration_database()')
      and privilege.privilege_type='EXECUTE')<>2 then
    raise exception 'ZHUDATUAN_REGISTRATION_MIGRATION_BOUNDARY_ACL_DRIFT';
  end if;
end
$assert$;

commit;
