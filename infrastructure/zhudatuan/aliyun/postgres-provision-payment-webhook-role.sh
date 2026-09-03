#!/bin/sh
set -eu
: "${POSTGRES_USER:?POSTGRES_USER is required}"
: "${POSTGRES_DB:?POSTGRES_DB is required}"
: "${ZHUDATUAN_EXPECTED_RDS_SERVER_ADDR:?ZHUDATUAN_EXPECTED_RDS_SERVER_ADDR is required}"
: "${ZHUDATUAN_PAYMENT_WEBHOOK_API_PASSWORD:?ZHUDATUAN_PAYMENT_WEBHOOK_API_PASSWORD is required}"
[ "$POSTGRES_DB" = "zhudatuan_registration" ] || {
  echo 'POSTGRES_DB must be zhudatuan_registration' >&2
  exit 1
}

exec /usr/bin/psql -X --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" <<'SQL'
\set ON_ERROR_STOP on
\getenv expected_database POSTGRES_DB
\getenv expected_server_addr ZHUDATUAN_EXPECTED_RDS_SERVER_ADDR
\getenv webhook_api_password ZHUDATUAN_PAYMENT_WEBHOOK_API_PASSWORD
begin;
set local search_path=pg_catalog,pg_temp;
set local password_encryption='scram-sha-256';

select
  pg_catalog.set_config('zhudatuan.payment_webhook.expected_database',:'expected_database',true) is not null database,
  pg_catalog.set_config('zhudatuan.payment_webhook.expected_server_addr',:'expected_server_addr',true) is not null server_addr
\gset guard_

select length(:'webhook_api_password')>=32 secrets_valid
\gset guard_
\if :guard_secrets_valid
\else
  \echo 'Payment webhook role secret contract invalid'
  \quit 3
\endif

do $guard$
declare
  expected_addr constant inet := current_setting('zhudatuan.payment_webhook.expected_server_addr')::inet;
  authority constant oid := (select oid from pg_roles where rolname=current_user);
  role_oid constant oid := to_regrole('zhudatuanpaymentwebhookapi');
begin
  if current_database()<>current_setting('zhudatuan.payment_webhook.expected_database')
    or current_database()<>'zhudatuan_registration' or pg_is_in_recovery()
    or inet_server_addr() is null or inet_server_addr()<>expected_addr
    or masklen(expected_addr)<>(case family(expected_addr) when 4 then 32 else 128 end)
    or not (expected_addr<<=inet '10.0.0.0/8' or expected_addr<<=inet '172.16.0.0/12'
      or expected_addr<<=inet '192.168.0.0/16' or expected_addr<<=inet 'fc00::/7') then
    raise exception 'ZHUDATUAN_PAYMENT_WEBHOOK_ROLE_DATABASE_IDENTITY_INVALID';
  end if;
  if authority is null or not (
      coalesce((select rolsuper from pg_roles where oid=authority),false)
      or coalesce(pg_has_role(authority,to_regrole('pg_rds_superuser'),'MEMBER'),false)
    ) then
    raise exception 'ZHUDATUAN_PAYMENT_WEBHOOK_ROLE_AUTHORITY_INVALID';
  end if;
  if not exists(select 1 from deployment.boundary
    where id='zhudatuan-registration-v1' and database_name=current_database()) then
    raise exception 'ZHUDATUAN_PAYMENT_WEBHOOK_ROLE_DATABASE_BOUNDARY_MISSING';
  end if;
  if role_oid is not null and (
      exists(select 1 from pg_roles where oid=role_oid
        and (rolsuper or rolcreatedb or rolcreaterole or rolinherit or rolreplication or rolbypassrls))
      or exists(select 1 from pg_auth_members where roleid=role_oid or member=role_oid)
    ) then
    raise exception 'ZHUDATUAN_PAYMENT_WEBHOOK_ROLE_EXISTING_ROLE_UNSAFE';
  end if;
end
$guard$;

select format('create role zhudatuanpaymentwebhookapi login password %L noinherit',:'webhook_api_password')
where to_regrole('zhudatuanpaymentwebhookapi') is null
\gexec

do $assert$
begin
  if not exists(select 1 from pg_roles where rolname='zhudatuanpaymentwebhookapi'
      and rolcanlogin and not rolsuper and not rolcreatedb and not rolcreaterole
      and not rolinherit and not rolreplication and not rolbypassrls)
    or exists(select 1 from pg_auth_members membership
      where membership.roleid=to_regrole('zhudatuanpaymentwebhookapi')
        or membership.member=to_regrole('zhudatuanpaymentwebhookapi')) then
    raise exception 'ZHUDATUAN_PAYMENT_WEBHOOK_ROLE_FINAL_STATE_INVALID';
  end if;
end
$assert$;

commit;
SQL
