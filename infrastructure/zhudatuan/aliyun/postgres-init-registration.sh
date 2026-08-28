#!/bin/sh
set -eu

[ "$POSTGRES_DB" = "zhudatuan_registration" ] || { echo 'POSTGRES_DB must be zhudatuan_registration' >&2; exit 1; }
case "$ZHUDATUAN_DATABASE_SENTINEL" in
  *[!A-Za-z0-9_-]*|'') echo 'ZHUDATUAN_DATABASE_SENTINEL is invalid' >&2; exit 1 ;;
esac
[ "${#ZHUDATUAN_DATABASE_SENTINEL}" -ge 43 ] || { echo 'ZHUDATUAN_DATABASE_SENTINEL is too short' >&2; exit 1; }

create_role() {
  role="$1"
  password="$2"
  psql --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" --set ON_ERROR_STOP=1 \
    --set role_name="$role" --set role_password="$password" <<'SQL'
select format('create role %I login password %L nosuperuser nocreatedb nocreaterole noinherit noreplication nobypassrls',
  :'role_name', :'role_password')
where not exists(select 1 from pg_roles where rolname=:'role_name') \gexec
SQL
}

# The four historical roles are required only so the immutable migration
# history can create/revoke its legacy grants. Runtime connections never use
# them after the registration baseline is reached.
create_role shopapp "$SHOPAPP_PASSWORD"
create_role shopjob "$SHOPJOB_PASSWORD"
create_role shopmigration "$SHOPMIGRATION_PASSWORD"
create_role shopread "$SHOPREAD_PASSWORD"
create_role zhudatuanidentityapi "$ZHUDATUAN_IDENTITY_API_PASSWORD"
create_role zhudatuanidentityjob "$ZHUDATUAN_IDENTITY_JOB_PASSWORD"
create_role zhudatuanbootstrap "$ZHUDATUAN_BOOTSTRAP_PASSWORD"
create_role zhudatuanwebapi "$ZHUDATUAN_WEB_API_PASSWORD"
create_role zhudatuanpurchaseapi "$ZHUDATUAN_PURCHASE_API_PASSWORD"
create_role zhudatuansandboxbootstrap "$ZHUDATUAN_SANDBOX_BOOTSTRAP_PASSWORD"

psql --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" --set ON_ERROR_STOP=1 \
  --set database_name="$POSTGRES_DB" --set sentinel="$ZHUDATUAN_DATABASE_SENTINEL" <<'SQL'
create extension if not exists pgcrypto;
grant shopapp,shopjob to shopmigration;
select format('grant shopmigration to %I',current_user) \gexec
select format('alter database %I owner to shopmigration', :'database_name') \gexec

create schema if not exists deployment authorization shopmigration;
revoke all on schema deployment from public;
create table if not exists deployment.boundary(
  id text primary key,
  database_name text not null,
  sentinel_hash char(64) not null check(sentinel_hash~'^[0-9a-f]{64}$'),
  created_at timestamptz not null default clock_timestamp()
);
revoke all on deployment.boundary from public,shopapp,shopjob,shopmigration,shopread,
  zhudatuanidentityapi,zhudatuanidentityjob,zhudatuanbootstrap,zhudatuanwebapi,zhudatuanpurchaseapi,zhudatuansandboxbootstrap;
grant select(id,database_name,sentinel_hash) on deployment.boundary to shopmigration;
insert into deployment.boundary(id,database_name,sentinel_hash)
values('zhudatuan-registration-v1',:'database_name',encode(public.digest(:'sentinel','sha256'),'hex'))
on conflict(id) do update set database_name=excluded.database_name,sentinel_hash=excluded.sentinel_hash;

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
grant execute on function deployment.registration_bootstrap_boundary(text) to zhudatuanbootstrap;
grant execute on function deployment.is_independent_registration_database() to shopmigration;
SQL
