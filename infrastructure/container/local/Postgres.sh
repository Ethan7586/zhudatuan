#!/bin/sh
set -eu

create_role() {
  role="$1"
  password="$2"
  if [ "$(psql --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" --tuples-only --no-align --command "select count(*) from pg_roles where rolname='$role'")" = "0" ]; then
    psql --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" --set ON_ERROR_STOP=1 --command "create role $role login password '$password' nobypassrls"
  fi
}

create_replay_role() {
  role="$1"
  if [ "$(psql --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" --tuples-only --no-align --command "select count(*) from pg_roles where rolname='$role'")" = "0" ]; then
    psql --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" --set ON_ERROR_STOP=1 --command "create role $role nologin noinherit nosuperuser nocreatedb nocreaterole noreplication nobypassrls"
  fi
}

create_role shopapp "$SHOPAPP_PASSWORD"
create_role shopjob "$SHOPJOB_PASSWORD"
create_role shopprovider "$SHOPPROVIDER_PASSWORD"
psql --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" --set ON_ERROR_STOP=1 --command "alter role shopprovider noinherit"
create_role shopmigration "$SHOPMIGRATION_PASSWORD"
psql --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" --set ON_ERROR_STOP=1 --command "grant shopmigration to $POSTGRES_USER"

hardcut="$(psql --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" --tuples-only --no-align --command "select to_regclass('runtime.schemaversion') is not null")"
if [ "$hardcut" != "t" ] || [ "$(psql --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" --tuples-only --no-align --command "select count(*) from runtime.schemaversion where version='20260829109000'")" = "0" ]; then
  create_replay_role zhudatuanidentityapi
  create_replay_role zhudatuanidentityjob
  create_replay_role zhudatuanbootstrap
  create_replay_role zhudatuanwebapi
  create_replay_role zhudatuanpurchaseapi
  create_replay_role zhudatuansandboxbootstrap
fi
