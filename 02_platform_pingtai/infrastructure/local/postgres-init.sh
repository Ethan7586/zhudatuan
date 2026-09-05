#!/bin/sh
set -eu

create_role() {
  role="$1"
  password="$2"
  if [ "$(psql --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" --tuples-only --no-align --command "select count(*) from pg_roles where rolname='$role'")" = "0" ]; then
    psql --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" --set ON_ERROR_STOP=1 --command "create role $role login password '$password' noinherit nosuperuser nocreatedb nocreaterole noreplication nobypassrls"
  fi
  psql --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" --set ON_ERROR_STOP=1 --command "alter role $role login password '$password' noinherit nosuperuser nocreatedb nocreaterole noreplication nobypassrls"
}

create_nologin_role() {
  role="$1"
  if [ "$(psql --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" --tuples-only --no-align --command "select count(*) from pg_roles where rolname='$role'")" = "0" ]; then
    psql --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" --set ON_ERROR_STOP=1 --command "create role $role nologin noinherit nosuperuser nocreatedb nocreaterole noreplication nobypassrls"
  fi
  psql --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" --set ON_ERROR_STOP=1 --command "alter role $role nologin noinherit nosuperuser nocreatedb nocreaterole noreplication nobypassrls"
}

create_login_role_without_password() {
  role="$1"
  if [ "$(psql --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" --tuples-only --no-align --command "select count(*) from pg_roles where rolname='$role'")" = "0" ]; then
    psql --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" --set ON_ERROR_STOP=1 --command "create role $role login noinherit nosuperuser nocreatedb nocreaterole noreplication nobypassrls"
  fi
  psql --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" --set ON_ERROR_STOP=1 --command "alter role $role login noinherit nosuperuser nocreatedb nocreaterole noreplication nobypassrls"
}

create_role shopapp "$SHOPAPP_PASSWORD"
create_role shopjob "$SHOPJOB_PASSWORD"
create_role shopmigration "$SHOPMIGRATION_PASSWORD"
create_nologin_role shopconsole
create_nologin_role zhudatuanidentityapi
create_nologin_role zhudatuanidentityjob
create_role zhudatuanbootstrap "$ZHUDATUANBOOTSTRAP_PASSWORD"
create_nologin_role zhudatuanwebapi
create_nologin_role zhudatuansandboxbootstrap
create_nologin_role zhudatuanpurchaseapi
create_nologin_role zhudatuanprovisioningapi
create_nologin_role zhudatuanpaymentwebhookapi
create_login_role_without_password zhudatuanconsoleapi
psql --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" --set ON_ERROR_STOP=1 --command "grant shopconsole to zhudatuanconsoleapi"
psql --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" --set ON_ERROR_STOP=1 --command "grant shopmigration to $POSTGRES_USER"
psql --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" --set ON_ERROR_STOP=1 <<'SQL'
\getenv database_sentinel DATABASE_SENTINEL
create schema if not exists deployment authorization shopmigration;
alter schema deployment owner to shopmigration;
create table if not exists deployment.boundary(
  id text primary key,
  database_name text not null,
  sentinel_hash char(64) not null check(sentinel_hash~'^[0-9a-f]{64}$'),
  created_at timestamptz not null default clock_timestamp()
);
alter table deployment.boundary owner to shopmigration;
revoke all on deployment.boundary from public;
insert into deployment.boundary(id,database_name,sentinel_hash)
values('zhudatuan-registration-v1',current_database(),
  encode(pg_catalog.sha256(pg_catalog.convert_to(:'database_sentinel','UTF8')),'hex'))
on conflict(id) do update set database_name=excluded.database_name,sentinel_hash=excluded.sentinel_hash;
create or replace function deployment.registration_bootstrap_boundary(p_sentinel text)
returns boolean language sql stable security definer
set search_path=pg_catalog,deployment as $function$
  select current_database()='zhudatuan_registration'
    and session_user='zhudatuanbootstrap'
    and exists(select 1 from deployment.boundary
      where id='zhudatuan-registration-v1' and database_name=current_database()
        and sentinel_hash=encode(pg_catalog.sha256(pg_catalog.convert_to(p_sentinel,'UTF8')),'hex'))
$function$;
create or replace function deployment.is_independent_registration_database()
returns boolean language sql stable security definer
set search_path=pg_catalog,deployment as $function$
  select current_database()='zhudatuan_registration'
    and exists(select 1 from deployment.boundary
      where id='zhudatuan-registration-v1' and database_name=current_database())
$function$;
alter function deployment.registration_bootstrap_boundary(text) owner to shopmigration;
alter function deployment.is_independent_registration_database() owner to shopmigration;
revoke all on function deployment.registration_bootstrap_boundary(text) from public;
revoke all on function deployment.is_independent_registration_database() from public;
grant usage on schema deployment to zhudatuanbootstrap,shopmigration;
grant execute on function deployment.registration_bootstrap_boundary(text) to zhudatuanbootstrap,shopmigration;
grant execute on function deployment.is_independent_registration_database() to shopmigration;
SQL
