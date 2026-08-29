#!/bin/sh
set -eu
: "${POSTGRES_USER:?POSTGRES_USER is required}"
: "${POSTGRES_DB:?POSTGRES_DB is required}"
[ "$POSTGRES_DB" = "zhudatuan_registration" ] || {
  echo 'POSTGRES_DB must be zhudatuan_registration' >&2
  exit 1
}

# PGPASSWORD is a libpq environment input; other secrets use psql \getenv.
exec /usr/bin/psql -X --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" <<'SQL'
\set ON_ERROR_STOP on
\getenv init_authority POSTGRES_USER
\getenv expected_database POSTGRES_DB
\getenv expected_server_addr ZHUDATUAN_EXPECTED_RDS_SERVER_ADDR
\getenv database_sentinel ZHUDATUAN_DATABASE_SENTINEL
\getenv shopapp_password SHOPAPP_PASSWORD
\getenv shopjob_password SHOPJOB_PASSWORD
\getenv shopmigration_password SHOPMIGRATION_PASSWORD
\getenv shopread_password SHOPREAD_PASSWORD
\getenv identity_api_password ZHUDATUAN_IDENTITY_API_PASSWORD
\getenv identity_job_password ZHUDATUAN_IDENTITY_JOB_PASSWORD
\getenv bootstrap_password ZHUDATUAN_BOOTSTRAP_PASSWORD
\getenv web_api_password ZHUDATUAN_WEB_API_PASSWORD
\getenv purchase_api_password ZHUDATUAN_PURCHASE_API_PASSWORD
\getenv sandbox_bootstrap_password ZHUDATUAN_SANDBOX_BOOTSTRAP_PASSWORD
begin;
set local search_path=pg_catalog,pg_temp;
set local password_encryption='scram-sha-256';

select
  pg_catalog.set_config('zhudatuan.init.authority',:'init_authority',true) is not null authority,
  pg_catalog.set_config('zhudatuan.init.expected_database',:'expected_database',true) is not null database,
  pg_catalog.set_config('zhudatuan.init.expected_server_addr',:'expected_server_addr',true) is not null server_addr,
  pg_catalog.set_config('zhudatuan.init.sentinel',:'database_sentinel',true) is not null sentinel
\gset guard_

select
  length(:'database_sentinel')>=43 and :'database_sentinel'~'^[A-Za-z0-9_-]+$'
  and length(:'shopapp_password')>=32 and length(:'shopjob_password')>=32
  and length(:'shopmigration_password')>=32 and length(:'shopread_password')>=32
  and length(:'identity_api_password')>=32 and length(:'identity_job_password')>=32
  and length(:'bootstrap_password')>=32 and length(:'web_api_password')>=32
  and length(:'purchase_api_password')>=32 and length(:'sandbox_bootstrap_password')>=32 secrets_valid
\gset guard_
\if :guard_secrets_valid
\else
  \echo 'RDS initialization secret contract invalid'
  \quit 3
\endif

-- This read-only block is the exact wrong-target boundary. No extension,
-- role, membership, database owner, schema, table or function DDL precedes it.
do $target_guard$
declare
  expected_database constant text := current_setting('zhudatuan.init.expected_database');
  expected_authority constant text := current_setting('zhudatuan.init.authority');
  expected_addr constant inet := current_setting('zhudatuan.init.expected_server_addr')::inet;
  actual_addr constant inet := inet_server_addr();
  authority constant oid := (select oid from pg_roles where rolname=current_user);
  boundary_role constant oid := to_regrole('zhudatuanregistrationboundary');
  boundary_table constant oid := to_regclass('deployment.boundary');
  application_roles constant text[] := array['anon','authenticated','service_role','shopapp','shopjob',
    'shopmigration','shopread','zhudatuanidentityapi','zhudatuanidentityjob','zhudatuanbootstrap',
    'zhudatuanwebapi','zhudatuanpurchaseapi','zhudatuansandboxbootstrap'];
  database_owner text := (select pg_get_userbyid(datdba) from pg_database where datname=current_database());
  existing boolean := boundary_table is not null;
begin
  if current_setting('server_version_num')::integer<160000
    or current_setting('server_version_num')::integer>=170000 then
    raise exception 'ZHUDATUAN_RDS_INIT_POSTGRES_VERSION_INVALID';
  end if;
  if expected_database<>'zhudatuan_registration' or current_database()<>expected_database
    or session_user<>expected_authority or current_user<>session_user or pg_is_in_recovery() then
    raise exception 'ZHUDATUAN_RDS_INIT_DATABASE_IDENTITY_INVALID';
  end if;
  if actual_addr is null or actual_addr<>expected_addr
    or masklen(expected_addr)<>(case family(expected_addr) when 4 then 32 else 128 end)
    or not (actual_addr<<=inet '10.0.0.0/8' or actual_addr<<=inet '172.16.0.0/12'
      or actual_addr<<=inet '192.168.0.0/16' or actual_addr<<=inet 'fc00::/7') then
    raise exception 'ZHUDATUAN_RDS_INIT_SERVER_ADDRESS_INVALID';
  end if;
  if authority is null or not (
      coalesce((select rolsuper from pg_roles where oid=authority),false)
      or coalesce(pg_has_role(authority,to_regrole('pg_rds_superuser'),'MEMBER'),false)
    ) then
    raise exception 'ZHUDATUAN_RDS_INIT_AUTHORITY_INVALID';
  end if;
  if boundary_role is null or not exists(select 1 from pg_roles where oid=boundary_role
      and not rolcanlogin and not rolsuper and not rolcreatedb and not rolcreaterole
      and not rolinherit and not rolreplication and not rolbypassrls) then
    raise exception 'ZHUDATUAN_RDS_INIT_BOUNDARY_ROLE_INVALID';
  end if;
  if exists(select 1 from pg_auth_members membership
    where membership.member=boundary_role
      or (membership.roleid=boundary_role and not (
        membership.member=authority and membership.grantor=authority
        and membership.set_option and not membership.inherit_option))) then
    raise exception 'ZHUDATUAN_RDS_INIT_BOUNDARY_MEMBERSHIP_INVALID';
  end if;

  if not existing then
    if to_regnamespace('deployment') is not null or database_owner<>current_user
      or exists(select 1 from pg_roles where rolname=any(application_roles))
      or exists(select 1 from pg_namespace
        where nspname!~'^pg_' and nspname not in('information_schema','public'))
      or exists(select 1 from pg_class relation join pg_namespace namespace on namespace.oid=relation.relnamespace
        where namespace.nspname='public' and relation.relkind in('r','p','v','m','S','f'))
      or exists(select 1 from pg_proc function join pg_namespace namespace on namespace.oid=function.pronamespace
        where namespace.nspname='public')
      or exists(select 1 from pg_extension where extname<>'plpgsql') then
      raise exception 'ZHUDATUAN_RDS_INIT_PRISTINE_TARGET_REQUIRED';
    end if;
  else
    if to_regnamespace('deployment') is null or database_owner<>'shopmigration'
      or (select count(*) from pg_roles where rolname=any(application_roles))<>cardinality(application_roles)
      or exists(select 1 from pg_roles where rolname=any(application_roles)
        and (rolsuper or rolcreatedb or rolcreaterole or rolinherit or rolreplication or rolbypassrls))
      or exists(select 1 from pg_roles where rolname=any(array['anon','authenticated','service_role']) and rolcanlogin)
      or exists(select 1 from pg_roles where rolname=any(application_roles[4:13]) and not rolcanlogin)
      or not exists(select 1 from pg_class where oid=boundary_table and relkind='r')
      or (select pg_get_userbyid(nspowner) from pg_namespace where oid=to_regnamespace('deployment'))<>'shopmigration'
      or (select pg_get_userbyid(relowner) from pg_class where oid=boundary_table)<>'shopmigration'
      or to_regprocedure('public.digest(text,text)') is null
      or (select count(*) from deployment.boundary)<>1
      or not exists(select 1 from deployment.boundary
        where id='zhudatuan-registration-v1' and database_name=current_database()
          and sentinel_hash=encode(public.digest(current_setting('zhudatuan.init.sentinel'),'sha256'),'hex'))
      or to_regprocedure('deployment.registration_bootstrap_boundary(text)') is null
      or to_regprocedure('deployment.is_independent_registration_database()') is null
      or (select pg_get_userbyid(proowner) from pg_proc
          where oid=to_regprocedure('deployment.registration_bootstrap_boundary(text)'))<>'shopmigration'
      or (select pg_get_userbyid(proowner) from pg_proc
          where oid=to_regprocedure('deployment.is_independent_registration_database()'))<>'shopmigration'
      or exists(select 1 from pg_auth_members membership
        join pg_roles granted on granted.oid=membership.roleid
        join pg_roles member on member.oid=membership.member
        where (granted.rolname=any(application_roles) or member.rolname=any(application_roles))
          and not (granted.rolname in('shopapp','shopjob') and member.rolname='shopmigration'
            and not membership.admin_option and not membership.inherit_option and membership.set_option))
      or (select count(*) from pg_auth_members membership
        join pg_roles granted on granted.oid=membership.roleid
        join pg_roles member on member.oid=membership.member
        where granted.rolname=any(application_roles) or member.rolname=any(application_roles))<>2 then
      raise exception 'ZHUDATUAN_RDS_INIT_EXISTING_TARGET_INVALID';
    end if;
  end if;
end
$target_guard$;

-- Prove the pre-created inert role is SET-capable before the first DDL.
set local role zhudatuanregistrationboundary;
reset role;

create extension if not exists pgcrypto with schema public;

select 'create role anon nologin noinherit' where to_regrole('anon') is null \gexec
select 'create role authenticated nologin noinherit' where to_regrole('authenticated') is null \gexec
select 'create role service_role nologin noinherit' where to_regrole('service_role') is null \gexec
select format('create role shopapp login password %L noinherit',:'shopapp_password') where to_regrole('shopapp') is null \gexec
select format('create role shopjob login password %L noinherit',:'shopjob_password') where to_regrole('shopjob') is null \gexec
select format('create role shopmigration login password %L noinherit',:'shopmigration_password') where to_regrole('shopmigration') is null \gexec
select format('create role shopread login password %L noinherit',:'shopread_password') where to_regrole('shopread') is null \gexec
select format('create role zhudatuanidentityapi login password %L noinherit',:'identity_api_password') where to_regrole('zhudatuanidentityapi') is null \gexec
select format('create role zhudatuanidentityjob login password %L noinherit',:'identity_job_password') where to_regrole('zhudatuanidentityjob') is null \gexec
select format('create role zhudatuanbootstrap login password %L noinherit',:'bootstrap_password') where to_regrole('zhudatuanbootstrap') is null \gexec
select format('create role zhudatuanwebapi login password %L noinherit',:'web_api_password') where to_regrole('zhudatuanwebapi') is null \gexec
select format('create role zhudatuanpurchaseapi login password %L noinherit',:'purchase_api_password') where to_regrole('zhudatuanpurchaseapi') is null \gexec
select format('create role zhudatuansandboxbootstrap login password %L noinherit',:'sandbox_bootstrap_password') where to_regrole('zhudatuansandboxbootstrap') is null \gexec

-- PG16 non-superusers cannot spell NOSUPERUSER in ALTER ROLE. Reject unsafe
-- attributes first, then change only login/password/inheritance attributes.
do $role_guard$
begin
  if exists(select 1 from pg_roles where rolname=any(array[
      'anon','authenticated','service_role','shopapp','shopjob','shopmigration','shopread',
      'zhudatuanidentityapi','zhudatuanidentityjob','zhudatuanbootstrap','zhudatuanwebapi',
      'zhudatuanpurchaseapi','zhudatuansandboxbootstrap'
    ]) and (rolsuper or rolcreatedb or rolcreaterole or rolreplication or rolbypassrls)) then
    raise exception 'ZHUDATUAN_RDS_INIT_ROLE_ATTRIBUTE_INVALID';
  end if;
end
$role_guard$;

alter role anon nologin password null noinherit;
alter role authenticated nologin password null noinherit;
alter role service_role nologin password null noinherit;
select format('alter role shopapp login password %L noinherit',:'shopapp_password') \gexec
select format('alter role shopjob login password %L noinherit',:'shopjob_password') \gexec
select format('alter role shopmigration login password %L noinherit',:'shopmigration_password') \gexec
select format('alter role shopread login password %L noinherit',:'shopread_password') \gexec
select format('alter role zhudatuanidentityapi login password %L noinherit',:'identity_api_password') \gexec
select format('alter role zhudatuanidentityjob login password %L noinherit',:'identity_job_password') \gexec
select format('alter role zhudatuanbootstrap login password %L noinherit',:'bootstrap_password') \gexec
select format('alter role zhudatuanwebapi login password %L noinherit',:'web_api_password') \gexec
select format('alter role zhudatuanpurchaseapi login password %L noinherit',:'purchase_api_password') \gexec
select format('alter role zhudatuansandboxbootstrap login password %L noinherit',:'sandbox_bootstrap_password') \gexec

grant shopapp,shopjob to shopmigration with inherit false,set true;
select format('alter database %I owner to shopmigration',current_database()) \gexec

set local role shopmigration;
create schema if not exists deployment authorization shopmigration;
revoke all on schema deployment from public;
create table if not exists deployment.boundary(
  id text primary key,
  database_name text not null,
  sentinel_hash char(64) not null check(sentinel_hash~'^[0-9a-f]{64}$'),
  created_at timestamptz not null default clock_timestamp()
);
revoke all on deployment.boundary from public,shopapp,shopjob,shopread,
  zhudatuanidentityapi,zhudatuanidentityjob,zhudatuanbootstrap,zhudatuanwebapi,
  zhudatuanpurchaseapi,zhudatuansandboxbootstrap;
insert into deployment.boundary(id,database_name,sentinel_hash)
values('zhudatuan-registration-v1',current_database(),encode(public.digest(:'database_sentinel','sha256'),'hex'))
on conflict(id) do nothing;

create or replace function deployment.registration_bootstrap_boundary(p_sentinel text)
returns boolean language sql stable security definer
set search_path=pg_catalog,deployment,public as $function$
  select current_database()='zhudatuan_registration'
    and session_user='zhudatuanbootstrap'
    and exists(select 1 from deployment.boundary
      where id='zhudatuan-registration-v1' and database_name=current_database()
        and sentinel_hash=encode(public.digest(p_sentinel,'sha256'),'hex'))
$function$;
create or replace function deployment.is_independent_registration_database()
returns boolean language sql stable security definer
set search_path=pg_catalog,deployment as $function$
  select current_database()='zhudatuan_registration'
    and exists(select 1 from deployment.boundary
      where id='zhudatuan-registration-v1' and database_name=current_database())
$function$;
revoke all on function deployment.registration_bootstrap_boundary(text) from public;
revoke all on function deployment.is_independent_registration_database() from public;
grant usage on schema deployment to zhudatuanbootstrap,shopmigration;
grant execute on function deployment.registration_bootstrap_boundary(text) to zhudatuanbootstrap,shopmigration;
grant execute on function deployment.is_independent_registration_database() to shopmigration;
reset role;

-- Remove only fixture/vendor-created direct administration edges. Any edge
-- that cannot be removed aborts the transaction; boundary membership stays 0.
select format('revoke %I from %I',granted.rolname,current_user)
from pg_auth_members membership
join pg_roles granted on granted.oid=membership.roleid
where membership.member=(select oid from pg_roles where rolname=current_user)
  and membership.grantor=(select oid from pg_roles where rolname=current_user)
  and granted.rolname=any(array[
    'anon','authenticated','service_role','shopapp','shopjob','shopmigration','shopread',
    'zhudatuanidentityapi','zhudatuanidentityjob','zhudatuanbootstrap','zhudatuanwebapi',
    'zhudatuanpurchaseapi','zhudatuansandboxbootstrap','zhudatuanregistrationboundary'
  ])
\gexec

do $final_assert$
declare
  project_roles constant text[] := array[
    'anon','authenticated','service_role','shopapp','shopjob','shopmigration','shopread',
    'zhudatuanidentityapi','zhudatuanidentityjob','zhudatuanbootstrap','zhudatuanwebapi',
    'zhudatuanpurchaseapi','zhudatuansandboxbootstrap'
  ];
begin
  if (select pg_get_userbyid(datdba) from pg_database where datname=current_database())<>'shopmigration'
    or (select pg_get_userbyid(nspowner) from pg_namespace where oid=to_regnamespace('deployment'))<>'shopmigration'
    or (select pg_get_userbyid(relowner) from pg_class where oid=to_regclass('deployment.boundary'))<>'shopmigration'
    or (select count(*) from deployment.boundary)<>1
    or not exists(select 1 from deployment.boundary
      where id='zhudatuan-registration-v1' and database_name=current_database()
        and sentinel_hash=encode(public.digest(current_setting('zhudatuan.init.sentinel'),'sha256'),'hex')) then
    raise exception 'ZHUDATUAN_RDS_INIT_FINAL_DATABASE_BOUNDARY_INVALID';
  end if;
  if exists(select 1 from pg_roles where rolname=any(project_roles)
      and (rolsuper or rolcreatedb or rolcreaterole or rolinherit or rolreplication or rolbypassrls))
    or exists(select 1 from pg_roles where rolname=any(array['anon','authenticated','service_role']) and rolcanlogin)
    or exists(select 1 from pg_roles where rolname=any(project_roles[4:13]) and not rolcanlogin) then
    raise exception 'ZHUDATUAN_RDS_INIT_FINAL_ROLE_INVALID';
  end if;
  if exists(select 1 from pg_auth_members membership
      where membership.roleid=to_regrole('zhudatuanregistrationboundary')
        or membership.member=to_regrole('zhudatuanregistrationboundary')) then
    raise exception 'ZHUDATUAN_RDS_INIT_BOUNDARY_MEMBERSHIP_REMAINS';
  end if;
  if exists(select 1 from pg_auth_members membership
    join pg_roles granted on granted.oid=membership.roleid
    join pg_roles member on member.oid=membership.member
    where (granted.rolname=any(project_roles) or member.rolname=any(project_roles))
      and not (granted.rolname in('shopapp','shopjob') and member.rolname='shopmigration'
        and not membership.admin_option and not membership.inherit_option and membership.set_option))
    or (select count(*) from pg_auth_members membership
      join pg_roles granted on granted.oid=membership.roleid
      join pg_roles member on member.oid=membership.member
      where granted.rolname=any(project_roles) or member.rolname=any(project_roles))<>2 then
    raise exception 'ZHUDATUAN_RDS_INIT_MEMBERSHIP_INVALID';
  end if;
end
$final_assert$;

commit;
SQL
