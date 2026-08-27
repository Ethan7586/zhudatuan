#!/bin/sh
set -eu

create_role() {
  role="$1"
  password="$2"
  if [ "$(psql --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" --tuples-only --no-align --command "select count(*) from pg_roles where rolname='$role'")" = "0" ]; then
    psql --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" --set ON_ERROR_STOP=1 --command "create role $role login password '$password' nobypassrls"
  fi
}

create_role shopapp "$SHOPAPP_PASSWORD"
create_role shopjob "$SHOPJOB_PASSWORD"
create_role shopmigration "$SHOPMIGRATION_PASSWORD"
psql --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" --set ON_ERROR_STOP=1 --command "grant shopmigration to $POSTGRES_USER"
