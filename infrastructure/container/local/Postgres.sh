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
  psql --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" --set ON_ERROR_STOP=1 --command "alter role $role nologin noinherit nosuperuser nocreatedb nocreaterole noreplication nobypassrls"
}

read_secret() {
  file="$1"
  [ -f "$file" ] || { printf 'local secret file missing: %s\n' "$file" >&2; exit 1; }
  cat "$file"
}

create_role shopapp "$(read_secret "$SHOPAPP_PASSWORD_FILE")"
create_role shopjob "$(read_secret "$SHOPJOB_PASSWORD_FILE")"
create_role shopprovider "$(read_secret "$SHOPPROVIDER_PASSWORD_FILE")"
psql --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" --set ON_ERROR_STOP=1 --command "alter role shopprovider noinherit"
create_replay_role shopmigration
psql --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" --set ON_ERROR_STOP=1 --command "alter role shopmigration nologin inherit nosuperuser nocreatedb nocreaterole noreplication nobypassrls"
psql --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" --set ON_ERROR_STOP=1 --command "grant shopmigration to $POSTGRES_USER"

for role in $MODULE_DATABASE_ROLES; do
  create_replay_role "$role"
  case "$role" in
    shop*owner)
      psql --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" --set ON_ERROR_STOP=1 --command "grant $role to shopmigration with inherit true"
      psql --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" --set ON_ERROR_STOP=1 --command "grant $role to shopmigration with admin true"
      ;;
  esac
done

hardcut="$(psql --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" --tuples-only --no-align --command "select to_regclass('runtime.schemaversion') is not null")"
if [ "$hardcut" != "t" ] || [ "$(psql --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" --tuples-only --no-align --command "select count(*) from runtime.schemaversion where version='20260829109000'")" = "0" ]; then
  create_replay_role zhudatuanidentityapi
  create_replay_role zhudatuanidentityjob
  create_replay_role zhudatuanbootstrap
  create_replay_role zhudatuanwebapi
  create_replay_role zhudatuanpurchaseapi
  create_replay_role zhudatuansandboxbootstrap
fi
