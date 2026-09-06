begin;

select pg_advisory_xact_lock(hashtext('zhudatuan:identity-catalog-commands:v1'));

do $precondition$
begin
  if not ((current_database()='zhudatuan_registration' and current_user='shopmigration')
    or coalesce((select rolsuper from pg_roles where rolname=current_user),false)) then
    raise exception 'IDENTITY_CATALOG_COMMANDS_DATABASE_INVALID';
  end if;
  if not exists(select 1 from runtime.schemaversion
    where version='20260906011000'
      and checksum='61e0eeb3593192e5e75b9ff4bf4df82678521d2d01f7e7d4177b56106ef5b51c') then
    raise exception 'IDENTITY_CATALOG_COMMANDS_PREDECESSOR_INVALID';
  end if;
  if exists(select 1 from runtime.schemaversion where version>'20260906011000') then
    raise exception 'IDENTITY_CATALOG_COMMANDS_FUTURE_HEAD_INVALID';
  end if;
  if to_regrole('zhudatuanidentityapi') is null
    or array_position(array[
      to_regclass('catalog.importjob'),to_regclass('catalog.importrow'),
      to_regclass('catalog.importerror'),to_regclass('catalog.listing'),to_regclass('runtime.job')
    ],null) is not null
    or to_regprocedure('access.scope_allowed(text)') is null then
    raise exception 'IDENTITY_CATALOG_COMMANDS_DEPENDENCY_MISSING';
  end if;
end
$precondition$;

grant select,insert,update on table catalog.importjob to zhudatuanidentityapi;
grant select on table catalog.importrow,catalog.importerror to zhudatuanidentityapi;
grant select,update on table catalog.listing to zhudatuanidentityapi;

create policy identityapiinsert on catalog.importjob for insert to zhudatuanidentityapi
  with check(access.scope_allowed(scope_id));
create policy identityapiupdate on catalog.importjob for update to zhudatuanidentityapi
  using(access.scope_allowed(scope_id)) with check(access.scope_allowed(scope_id));
create policy identityapiread on catalog.importrow for select to zhudatuanidentityapi
  using(access.scope_allowed(scope_id));
create policy identityapiupdate on catalog.listing for update to zhudatuanidentityapi
  using(access.scope_allowed(scope_id)) with check(access.scope_allowed(scope_id));

insert into runtime.schemaversion(version,checksum)
values('20260907010000','89fb0fcf3fd865a1e3076be775690536375b6e4a11bab251df3e9c262e1d1ac3');

do $assert$
begin
  if not has_table_privilege('zhudatuanidentityapi','catalog.importjob','SELECT')
    or not has_table_privilege('zhudatuanidentityapi','catalog.importjob','INSERT')
    or not has_table_privilege('zhudatuanidentityapi','catalog.importjob','UPDATE')
    or not has_table_privilege('zhudatuanidentityapi','catalog.importrow','SELECT')
    or not has_table_privilege('zhudatuanidentityapi','catalog.importerror','SELECT')
    or not has_table_privilege('zhudatuanidentityapi','catalog.listing','SELECT')
    or not has_table_privilege('zhudatuanidentityapi','catalog.listing','UPDATE') then
    raise exception 'IDENTITY_CATALOG_COMMANDS_ACL_INVALID';
  end if;
  if not exists(select 1 from pg_policies where schemaname='catalog' and tablename='importjob'
      and policyname='identityapiinsert' and cmd='INSERT' and 'zhudatuanidentityapi'=any(roles::text[]))
    or not exists(select 1 from pg_policies where schemaname='catalog' and tablename='importjob'
      and policyname='identityapiupdate' and cmd='UPDATE' and 'zhudatuanidentityapi'=any(roles::text[]))
    or not exists(select 1 from pg_policies where schemaname='catalog' and tablename='importrow'
      and policyname='identityapiread' and cmd='SELECT' and 'zhudatuanidentityapi'=any(roles::text[]))
    or not exists(select 1 from pg_policies where schemaname='catalog' and tablename='listing'
      and policyname='identityapiupdate' and cmd='UPDATE' and 'zhudatuanidentityapi'=any(roles::text[])) then
    raise exception 'IDENTITY_CATALOG_COMMANDS_POLICY_INVALID';
  end if;
  if not exists(select 1 from runtime.schemaversion
    where version='20260907010000'
      and checksum='89fb0fcf3fd865a1e3076be775690536375b6e4a11bab251df3e9c262e1d1ac3') then
    raise exception 'IDENTITY_CATALOG_COMMANDS_LEDGER_INVALID';
  end if;
end
$assert$;

commit;
