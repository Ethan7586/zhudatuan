begin;

select pg_advisory_xact_lock(hashtext('zhudatuan:registration-boundary-reconcile:v1'));

do $reconcile$
declare
  boundary_owner_name constant text := 'zhudatuanregistrationboundary';
  authority oid := (select oid from pg_roles where rolname=current_user);
  rds_superuser oid := to_regrole('pg_rds_superuser');
  boundary_owner oid := to_regrole(boundary_owner_name);
  bootstrap_boundary oid;
  migration_boundary oid;
  bootstrap_owner oid;
  migration_owner oid;
  bootstrap_definition text;
  migration_definition text;
  grantee_name text;
begin
  if current_database()<>'zhudatuan_registration'
    or not (
      coalesce((select rolsuper from pg_roles where oid=authority),false)
      or coalesce(pg_has_role(authority,rds_superuser,'MEMBER'),false)
    ) then
    raise exception 'ZHUDATUAN_REGISTRATION_BOUNDARY_RECONCILE_AUTHORITY_INVALID';
  end if;
  bootstrap_boundary := to_regprocedure('deployment.registration_bootstrap_boundary(text)');
  migration_boundary := to_regprocedure('deployment.is_independent_registration_database()');
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
    where function.oid=bootstrap_boundary
      and function.prosecdef
      and function.provolatile='s'
      and function.prorettype='boolean'::regtype
      and coalesce(array_length(function.proconfig,1),0)=1) then
    raise exception 'ZHUDATUAN_REGISTRATION_BOOTSTRAP_BOUNDARY_CONTRACT_INVALID';
  end if;
  select function.proowner,lower(pg_get_functiondef(function.oid))
    into bootstrap_owner,bootstrap_definition
  from pg_proc function where function.oid=bootstrap_boundary;
  if bootstrap_definition !~ $pattern$session_user\s*=\s*'zhudatuanbootstrap'$pattern$
    or bootstrap_definition !~ $pattern$current_database\(\)\s*=\s*'zhudatuan_registration'$pattern$
    or bootstrap_definition !~ $pattern$id\s*=\s*'zhudatuan-registration-v1'$pattern$
    or not (
      (
        bootstrap_definition ~ $pattern$sentinel_hash\s*=\s*encode\s*\(\s*public\.digest$pattern$
        and exists(select 1 from pg_proc function where function.oid=bootstrap_boundary
          and exists(select 1 from unnest(function.proconfig) setting
            where regexp_replace(setting,'\s','','g')='search_path=pg_catalog,deployment,public'))
      ) or (
        bootstrap_definition ~ $pattern$sentinel_hash\s*=\s*encode\s*\(\s*pg_catalog\.sha256\s*\(\s*pg_catalog\.convert_to\s*\(\s*p_sentinel$pattern$
        and exists(select 1 from pg_proc function where function.oid=bootstrap_boundary
          and exists(select 1 from unnest(function.proconfig) setting
            where regexp_replace(setting,'\s','','g')='search_path=pg_catalog,deployment'))
      )
    ) then
    raise exception 'ZHUDATUAN_REGISTRATION_BOOTSTRAP_BOUNDARY_DEFINITION_DRIFT';
  end if;

  if not exists(select 1 from pg_proc function
    where function.oid=migration_boundary
      and function.prosecdef
      and function.provolatile='s'
      and function.prorettype='boolean'::regtype
      and coalesce(array_length(function.proconfig,1),0)=1
      and exists(select 1 from unnest(function.proconfig) setting
        where regexp_replace(setting,'\s','','g')='search_path=pg_catalog,deployment')) then
    raise exception 'ZHUDATUAN_REGISTRATION_MIGRATION_BOUNDARY_CONTRACT_INVALID';
  end if;
  select function.proowner,lower(pg_get_functiondef(function.oid))
    into migration_owner,migration_definition
  from pg_proc function where function.oid=migration_boundary;
  if migration_definition !~ $pattern$current_database\(\)\s*=\s*'zhudatuan_registration'$pattern$
    or migration_definition !~ $pattern$id\s*=\s*'zhudatuan-registration-v1'$pattern$ then
    raise exception 'ZHUDATUAN_REGISTRATION_MIGRATION_BOUNDARY_DEFINITION_DRIFT';
  end if;

  if boundary_owner is null then
    if not coalesce((select rolsuper from pg_roles where oid=authority),false) then
      raise exception 'ZHUDATUAN_REGISTRATION_BOUNDARY_OWNER_MISSING';
    end if;
    execute format('create role %I nologin nosuperuser nocreatedb nocreaterole noinherit noreplication nobypassrls',
      boundary_owner_name);
    boundary_owner := to_regrole(boundary_owner_name);
  end if;
  -- A PG16 CREATEROLE account may harden login/password/inheritance for a
  -- role it administers, but only a real SUPERUSER may spell NOSUPERUSER in
  -- ALTER ROLE.  Dangerous attributes are therefore rejected, never repaired.
  if not exists(select 1 from pg_roles where oid=boundary_owner
    and not rolsuper and not rolcreatedb and not rolcreaterole
    and not rolreplication and not rolbypassrls) then
    raise exception 'ZHUDATUAN_REGISTRATION_BOUNDARY_OWNER_ROLE_INVALID';
  end if;
  execute format('alter role %I nologin password null noinherit',boundary_owner_name);
  if not exists(select 1 from pg_roles where oid=boundary_owner
    and not rolcanlogin and not rolsuper and not rolcreatedb and not rolcreaterole
    and not rolinherit and not rolreplication and not rolbypassrls) then
    raise exception 'ZHUDATUAN_REGISTRATION_BOUNDARY_OWNER_ROLE_INVALID';
  end if;
  if exists(select 1 from pg_auth_members where member=boundary_owner)
    or exists(select 1 from pg_auth_members where roleid=boundary_owner and member<>authority) then
    raise exception 'ZHUDATUAN_REGISTRATION_BOUNDARY_OWNER_MEMBERSHIP_FORBIDDEN';
  end if;

  if bootstrap_owner=boundary_owner or migration_owner=boundary_owner then
    if bootstrap_owner<>boundary_owner or migration_owner<>boundary_owner then
      raise exception 'ZHUDATUAN_REGISTRATION_BOUNDARY_OWNER_PARTIAL';
    end if;
    if exists(select 1 from pg_auth_members where member=boundary_owner)
      or exists(select 1 from pg_auth_members where roleid=boundary_owner and member<>authority) then
      raise exception 'ZHUDATUAN_REGISTRATION_BOUNDARY_OWNER_MEMBERSHIP_FORBIDDEN';
    end if;
    return;
  end if;

  -- Aliyun's pg_rds_superuser can SET ROLE to an ordinary account without a
  -- catalog membership.  A vanilla-PG fixture supplies the equivalent
  -- disposable SET/ADMIN edge before entering this reviewed transaction.
  execute format('grant usage,create on schema deployment to %I',boundary_owner_name);
  execute format('grant select(id,database_name,sentinel_hash) on deployment.boundary to %I',boundary_owner_name);

  execute 'revoke all on function deployment.registration_bootstrap_boundary(text) from public';
  for grantee_name in
    select distinct grantee.rolname
    from pg_proc function
    cross join lateral aclexplode(coalesce(function.proacl,acldefault('f',function.proowner))) privilege
    join pg_roles grantee on grantee.oid=privilege.grantee
    where function.oid=bootstrap_boundary
      and grantee.oid<>function.proowner
      and grantee.rolname not in('zhudatuanbootstrap','shopmigration')
  loop
    execute format('revoke all on function deployment.registration_bootstrap_boundary(text) from %I',grantee_name);
  end loop;
  execute 'revoke all on function deployment.is_independent_registration_database() from public';
  for grantee_name in
    select distinct grantee.rolname
    from pg_proc function
    cross join lateral aclexplode(coalesce(function.proacl,acldefault('f',function.proowner))) privilege
    join pg_roles grantee on grantee.oid=privilege.grantee
    where function.oid=migration_boundary
      and grantee.oid<>function.proowner
      and grantee.rolname<>'shopmigration'
  loop
    execute format('revoke all on function deployment.is_independent_registration_database() from %I',grantee_name);
  end loop;
  execute 'grant usage on schema deployment to zhudatuanbootstrap,shopmigration';
  execute 'grant execute on function deployment.registration_bootstrap_boundary(text) to zhudatuanbootstrap,shopmigration;';
  execute 'grant execute on function deployment.is_independent_registration_database() to shopmigration;';
  execute format('alter function deployment.registration_bootstrap_boundary(text) owner to %I',boundary_owner_name);
  execute format('alter function deployment.is_independent_registration_database() owner to %I',boundary_owner_name);

  -- A disposable fixture edge may only target the current authority.  The
  -- Aliyun path has no pg_auth_members row and relies on pg_rds_superuser's
  -- documented SET ROLE capability.
  if exists(select 1 from pg_auth_members where member=boundary_owner)
    or exists(select 1 from pg_auth_members where roleid=boundary_owner and member<>authority) then
    raise exception 'ZHUDATUAN_REGISTRATION_BOUNDARY_OWNER_MEMBERSHIP_FORBIDDEN';
  end if;
end
$reconcile$;

-- Runtime workloads need a narrow, data-free oracle that proves the reviewed
-- migration/bootstrap/retirement sequence still holds.  The oracle is owned
-- by the inert boundary role so the notification worker does not need SELECT
-- on identity/access data and no retired login remains usable as a definer.
do $runtime_boundary_membership$
begin
  if to_regrole('zhudatuanregistrationboundary') is null then
    raise exception 'ZHUDATUAN_RUNTIME_DATABASE_BOUNDARY_OWNER_MISSING';
  end if;
end
$runtime_boundary_membership$;

grant usage on schema access,deployment,runtime to zhudatuanregistrationboundary;
grant create on schema deployment to zhudatuanregistrationboundary;
grant select on access.role,access.membership,access.membershiprole to zhudatuanregistrationboundary;
grant select on runtime.schemaversion to zhudatuanregistrationboundary;

drop policy if exists zhudatuanregistrationboundary_runtime_guard on access.role;
create policy zhudatuanregistrationboundary_runtime_guard on access.role
  for select to zhudatuanregistrationboundary using(true);
drop policy if exists zhudatuanregistrationboundary_runtime_guard on access.membership;
create policy zhudatuanregistrationboundary_runtime_guard on access.membership
  for select to zhudatuanregistrationboundary using(true);
drop policy if exists zhudatuanregistrationboundary_runtime_guard on access.membershiprole;
create policy zhudatuanregistrationboundary_runtime_guard on access.membershiprole
  for select to zhudatuanregistrationboundary using(true);
drop policy if exists zhudatuanregistrationboundary_runtime_guard on runtime.schemaversion;
create policy zhudatuanregistrationboundary_runtime_guard on runtime.schemaversion
  for select to zhudatuanregistrationboundary using(true);

grant usage on schema deployment to shopjob,zhudatuanidentityapi,zhudatuanidentityjob;
set local role zhudatuanregistrationboundary;
create or replace function deployment.registration_bootstrap_boundary(p_sentinel text)
returns boolean language sql stable security definer
set search_path=pg_catalog,deployment as $function$
  select current_database()='zhudatuan_registration'
    and session_user='zhudatuanbootstrap'
    and exists(select 1 from deployment.boundary
      where id='zhudatuan-registration-v1' and database_name=current_database()
        and sentinel_hash=encode(pg_catalog.sha256(pg_catalog.convert_to(p_sentinel,'UTF8')),'hex'))
$function$;
create or replace function deployment.runtime_database_boundary()
returns table(
  active_platform_owner_count integer,
  migration_head_valid boolean,
  retired_roles_valid boolean,
  runtime_roles_valid boolean,
  boundary_roles_valid boolean,
  retired_membership_count integer,
  registration_boundary_owner text,
  migration_boundary_owner text,
  runtime_boundary_owner text,
  database_owner text
)
language sql stable security definer
set search_path=pg_catalog,pg_temp as $function$
  select
    (select count(distinct membership.id)::integer
      from access.membership membership
      join access.membershiprole assignment on assignment.membership_id=membership.id
      join access.role role on role.id=assignment.role_id
      where membership.client='operator' and membership.status='active'
        and assignment.role_id='role-platform-owner-v2'
        and assignment.effective_at<=clock_timestamp()
        and (assignment.expires_at is null or assignment.expires_at>clock_timestamp())
        and role.scope_id='tenant-zhudatuan' and role.status='active'),
    exists(select 1 from runtime.schemaversion
      where version='20260829060000'
        and checksum='b1e238eb8de569b0de9d1d2766620e1f661268d2f9260e646208d4f24715b37a'),
    (select count(*)=7 and not exists(
      select 1 from pg_roles role where role.rolname=any(array[
          'shopapp','shopmigration','shopread','zhudatuanbootstrap','zhudatuanwebapi',
          'zhudatuanpurchaseapi','zhudatuansandboxbootstrap'
        ])
        and (role.rolcanlogin or role.rolsuper or role.rolcreatedb or role.rolcreaterole
          or role.rolinherit or role.rolreplication or role.rolbypassrls)
    ) from pg_roles role where role.rolname=any(array[
      'shopapp','shopmigration','shopread','zhudatuanbootstrap','zhudatuanwebapi',
      'zhudatuanpurchaseapi','zhudatuansandboxbootstrap'
    ])),
    (select count(*)=3 and not exists(
      select 1 from pg_roles role
      where role.rolname=any(array['shopjob','zhudatuanidentityapi','zhudatuanidentityjob'])
        and (not role.rolcanlogin or role.rolsuper or role.rolcreatedb or role.rolcreaterole
          or role.rolinherit or role.rolreplication or role.rolbypassrls)
    ) from pg_roles role where role.rolname=any(array['shopjob','zhudatuanidentityapi','zhudatuanidentityjob'])),
    (select count(*)=4 and not exists(
      select 1 from pg_roles role
      where role.rolname=any(array['anon','authenticated','service_role','zhudatuanregistrationboundary'])
        and (role.rolcanlogin or role.rolsuper or role.rolcreatedb or role.rolcreaterole
          or role.rolinherit or role.rolreplication or role.rolbypassrls)
    ) and not exists(
      select 1 from pg_auth_members membership
      where membership.roleid in(select role.oid from pg_roles role
          where role.rolname=any(array['anon','authenticated','service_role','zhudatuanregistrationboundary']))
        or membership.member in(select role.oid from pg_roles role
          where role.rolname=any(array['anon','authenticated','service_role','zhudatuanregistrationboundary']))
    ) from pg_roles role
      where role.rolname=any(array['anon','authenticated','service_role','zhudatuanregistrationboundary'])),
    (select count(*)::integer from pg_auth_members membership
      where membership.roleid in(select role.oid from pg_roles role where role.rolname=any(array[
          'shopapp','shopmigration','shopread','zhudatuanbootstrap','zhudatuanwebapi',
          'zhudatuanpurchaseapi','zhudatuansandboxbootstrap'
        ]))
        or membership.member in(select role.oid from pg_roles role where role.rolname=any(array[
          'shopapp','shopmigration','shopread','zhudatuanbootstrap','zhudatuanwebapi',
          'zhudatuanpurchaseapi','zhudatuansandboxbootstrap'
        ]))),
    (select pg_get_userbyid(function.proowner)
      from pg_proc function where function.oid=to_regprocedure('deployment.registration_bootstrap_boundary(text)')),
    (select pg_get_userbyid(function.proowner)
      from pg_proc function where function.oid=to_regprocedure('deployment.is_independent_registration_database()')),
    (select pg_get_userbyid(function.proowner)
      from pg_proc function where function.oid=to_regprocedure('deployment.runtime_database_boundary()')),
    (select pg_get_userbyid(database.datdba) from pg_database database where database.datname=current_database())
$function$;

revoke all on function deployment.runtime_database_boundary() from public,anon,authenticated,service_role,
  shopapp,shopmigration,shopread,zhudatuanbootstrap,zhudatuanwebapi,zhudatuanpurchaseapi,zhudatuansandboxbootstrap;
grant execute on function deployment.runtime_database_boundary()
  to shopjob,zhudatuanidentityapi,zhudatuanidentityjob;
reset role;
revoke create on schema deployment from zhudatuanregistrationboundary;

do $runtime_boundary_membership_revoke$
begin
  if exists(select 1 from pg_auth_members
    where roleid=to_regrole('zhudatuanregistrationboundary') and member=to_regrole(current_user)) then
    execute format('revoke %I from %I','zhudatuanregistrationboundary',current_user);
  end if;
  if exists(select 1 from pg_auth_members
    where roleid=to_regrole('zhudatuanregistrationboundary')
      or member=to_regrole('zhudatuanregistrationboundary')) then
    raise exception 'ZHUDATUAN_RUNTIME_DATABASE_BOUNDARY_MEMBERSHIP_FORBIDDEN';
  end if;
end
$runtime_boundary_membership_revoke$;

do $assert$
declare
  boundary_owner oid := to_regrole('zhudatuanregistrationboundary');
  bootstrap_boundary oid := to_regprocedure('deployment.registration_bootstrap_boundary(text)');
  migration_boundary oid := to_regprocedure('deployment.is_independent_registration_database()');
  runtime_boundary oid := to_regprocedure('deployment.runtime_database_boundary()');
  unexpected_public_functions text;
begin
  if boundary_owner is null or not exists(select 1 from pg_roles where oid=boundary_owner
    and not rolcanlogin and not rolsuper and not rolcreatedb and not rolcreaterole
    and not rolinherit and not rolreplication and not rolbypassrls)
    or exists(select 1 from pg_auth_members where roleid=boundary_owner or member=boundary_owner) then
    raise exception 'ZHUDATUAN_REGISTRATION_BOUNDARY_OWNER_FINAL_STATE_INVALID';
  end if;
  if not exists(select 1 from pg_proc function where function.oid=bootstrap_boundary
      and function.proowner=boundary_owner and function.prosecdef and function.provolatile='s'
      and function.prorettype='boolean'::regtype
      and coalesce(array_length(function.proconfig,1),0)=1
      and exists(select 1 from unnest(function.proconfig) setting
        where regexp_replace(setting,'\s','','g')='search_path=pg_catalog,deployment'))
    or not exists(select 1 from pg_proc function where function.oid=migration_boundary
      and function.proowner=boundary_owner and function.prosecdef and function.provolatile='s'
      and function.prorettype='boolean'::regtype
      and coalesce(array_length(function.proconfig,1),0)=1
      and exists(select 1 from unnest(function.proconfig) setting
        where regexp_replace(setting,'\s','','g')='search_path=pg_catalog,deployment')) then
    raise exception 'ZHUDATUAN_REGISTRATION_BOUNDARY_OWNER_TRANSFER_FAILED';
  end if;
  if not exists(select 1 from pg_proc function where function.oid=runtime_boundary
      and function.proowner=boundary_owner and function.prosecdef and function.provolatile='s' and function.proretset
      and coalesce(array_length(function.proconfig,1),0)=1
      and exists(select 1 from unnest(function.proconfig) setting
        where regexp_replace(setting,'\s','','g')='search_path=pg_catalog,pg_temp')) then
    raise exception 'ZHUDATUAN_RUNTIME_DATABASE_BOUNDARY_CONTRACT_INVALID';
  end if;
  if not has_schema_privilege('zhudatuanregistrationboundary','deployment','USAGE')
    or has_schema_privilege('zhudatuanregistrationboundary','deployment','CREATE')
    or has_schema_privilege('zhudatuanregistrationboundary','public','USAGE')
    or has_schema_privilege('zhudatuanregistrationboundary','public','CREATE')
    or not has_schema_privilege('zhudatuanregistrationboundary','access','USAGE')
    or not has_schema_privilege('zhudatuanregistrationboundary','runtime','USAGE')
    or not has_table_privilege('zhudatuanregistrationboundary','access.role','SELECT')
    or not has_table_privilege('zhudatuanregistrationboundary','access.membership','SELECT')
    or not has_table_privilege('zhudatuanregistrationboundary','access.membershiprole','SELECT')
    or not has_table_privilege('zhudatuanregistrationboundary','runtime.schemaversion','SELECT')
    or not has_column_privilege('zhudatuanregistrationboundary','deployment.boundary','id','SELECT')
    or not has_column_privilege('zhudatuanregistrationboundary','deployment.boundary','database_name','SELECT')
    or not has_column_privilege('zhudatuanregistrationboundary','deployment.boundary','sentinel_hash','SELECT') then
    raise exception 'ZHUDATUAN_REGISTRATION_BOUNDARY_OWNER_PRIVILEGE_INVALID';
  end if;
  select string_agg(function.oid::regprocedure::text,',' order by function.oid::regprocedure::text)
  into unexpected_public_functions
  from pg_proc function
    join pg_namespace namespace on namespace.oid=function.pronamespace and namespace.nspname='public'
    where has_schema_privilege(boundary_owner,namespace.oid,'USAGE')
      and has_function_privilege(boundary_owner,function.oid,'EXECUTE');
  if unexpected_public_functions is not null then
    raise exception 'ZHUDATUAN_REGISTRATION_BOUNDARY_PUBLIC_FUNCTION_ACL_INVALID:%',unexpected_public_functions;
  end if;
  if not has_function_privilege('zhudatuanbootstrap','deployment.registration_bootstrap_boundary(text)','EXECUTE')
    or not has_function_privilege('shopmigration','deployment.registration_bootstrap_boundary(text)','EXECUTE')
    or not has_function_privilege('shopmigration','deployment.is_independent_registration_database()','EXECUTE') then
    raise exception 'ZHUDATUAN_REGISTRATION_BOUNDARY_RECONCILE_FAILED';
  end if;
  if exists(select 1 from (values('shopjob'),('zhudatuanidentityapi'),('zhudatuanidentityjob')) expected(role_name)
      where not has_schema_privilege(expected.role_name,'deployment','USAGE')
        or not has_function_privilege(expected.role_name,'deployment.runtime_database_boundary()','EXECUTE'))
    or exists(select 1 from (values('shopapp'),('shopmigration'),('shopread'),('zhudatuanbootstrap'),
        ('zhudatuanwebapi'),('zhudatuanpurchaseapi'),('zhudatuansandboxbootstrap'),('anon'),('authenticated'),('service_role')) denied(role_name)
      where has_function_privilege(denied.role_name,'deployment.runtime_database_boundary()','EXECUTE')) then
    raise exception 'ZHUDATUAN_RUNTIME_DATABASE_BOUNDARY_ACL_INVALID';
  end if;
  if (select count(*) from pg_policies where schemaname='access'
      and tablename in('role','membership','membershiprole')
      and policyname='zhudatuanregistrationboundary_runtime_guard'
      and roles=array['zhudatuanregistrationboundary']::name[])<>3 then
    raise exception 'ZHUDATUAN_RUNTIME_DATABASE_BOUNDARY_POLICY_INVALID';
  end if;
  if not exists(select 1 from pg_policies where schemaname='runtime' and tablename='schemaversion'
      and policyname='zhudatuanregistrationboundary_runtime_guard'
      and roles=array['zhudatuanregistrationboundary']::name[]) then
    raise exception 'ZHUDATUAN_RUNTIME_DATABASE_BOUNDARY_SCHEMA_POLICY_INVALID';
  end if;
  if exists(
    select 1 from pg_proc function
    cross join lateral aclexplode(coalesce(function.proacl,acldefault('f',function.proowner))) privilege
    left join pg_roles grantee on grantee.oid=privilege.grantee
    where function.oid=runtime_boundary
      and (privilege.privilege_type<>'EXECUTE' or privilege.grantee=0
        or (privilege.grantee<>function.proowner
          and grantee.rolname not in('shopjob','zhudatuanidentityapi','zhudatuanidentityjob'))
        or (privilege.grantee<>function.proowner and privilege.is_grantable))
  ) or (select count(distinct privilege.grantee)
    from pg_proc function
    cross join lateral aclexplode(coalesce(function.proacl,acldefault('f',function.proowner))) privilege
    where function.oid=runtime_boundary and privilege.privilege_type='EXECUTE')<>4 then
    raise exception 'ZHUDATUAN_RUNTIME_DATABASE_BOUNDARY_ACL_DRIFT';
  end if;
  if exists(
    select 1 from pg_proc function
    cross join lateral aclexplode(coalesce(function.proacl,acldefault('f',function.proowner))) privilege
    left join pg_roles grantee on grantee.oid=privilege.grantee
    where function.oid=bootstrap_boundary
      and (
        privilege.privilege_type<>'EXECUTE'
        or privilege.grantee=0
        or (privilege.grantee<>function.proowner and grantee.rolname not in('zhudatuanbootstrap','shopmigration'))
        or (privilege.grantee<>function.proowner and privilege.is_grantable)
      )
  ) or (select count(distinct privilege.grantee)
    from pg_proc function
    cross join lateral aclexplode(coalesce(function.proacl,acldefault('f',function.proowner))) privilege
    where function.oid=bootstrap_boundary and privilege.privilege_type='EXECUTE')<>3 then
    raise exception 'ZHUDATUAN_REGISTRATION_BOOTSTRAP_BOUNDARY_ACL_DRIFT';
  end if;
  if exists(
    select 1 from pg_proc function
    cross join lateral aclexplode(coalesce(function.proacl,acldefault('f',function.proowner))) privilege
    left join pg_roles grantee on grantee.oid=privilege.grantee
    where function.oid=migration_boundary
      and (
        privilege.privilege_type<>'EXECUTE'
        or privilege.grantee=0
        or (privilege.grantee<>function.proowner and grantee.rolname<>'shopmigration')
        or (privilege.grantee<>function.proowner and privilege.is_grantable)
      )
  ) or (select count(distinct privilege.grantee)
    from pg_proc function
    cross join lateral aclexplode(coalesce(function.proacl,acldefault('f',function.proowner))) privilege
    where function.oid=migration_boundary and privilege.privilege_type='EXECUTE')<>2 then
    raise exception 'ZHUDATUAN_REGISTRATION_MIGRATION_BOUNDARY_ACL_DRIFT';
  end if;
end
$assert$;

commit;
