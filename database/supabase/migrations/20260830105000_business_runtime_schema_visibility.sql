begin;

select pg_advisory_xact_lock(hashtext('zhudatuan:business-runtime-schema-visibility:v1'));

do $precondition$
begin
  if not ((current_database()='zhudatuan_registration' and current_user='shopmigration')
    or coalesce((select rolsuper from pg_roles where rolname=current_user),false)) then
    raise exception 'BUSINESS_RUNTIME_SCHEMA_VISIBILITY_BOUNDARY_INVALID';
  end if;
  if not exists(select 1 from runtime.schemaversion
    where version='20260830104000'
      and checksum='4b693e1cf34f5a1d59355942b5893f8075b302e53bfe41aba9c9564017bb2b0c') then
    raise exception 'BUSINESS_RUNTIME_SCHEMA_VISIBILITY_PREDECESSOR_INVALID';
  end if;
  if exists(select 1 from runtime.schemaversion where version>'20260830104000') then
    raise exception 'BUSINESS_RUNTIME_SCHEMA_VISIBILITY_FUTURE_HEAD_INVALID';
  end if;
end
$precondition$;

-- Runtime compatibility checks must resolve member.profile before proving
-- that neither role has table access. Schema visibility exposes no rows.
grant usage on schema member to zhudatuanwebapi,zhudatuanpurchaseapi;

insert into runtime.schemaversion(version,checksum)
values('20260830105000','b6ee9a1f1a8591f9efdf4c8c2362b9aa32a16b3ce018321df97669a56e6fcaaf');

do $assert$
begin
  if not has_schema_privilege('zhudatuanwebapi','member','USAGE')
    or not has_schema_privilege('zhudatuanpurchaseapi','member','USAGE')
    or has_table_privilege('zhudatuanwebapi','member.profile','SELECT,INSERT,UPDATE,DELETE')
    or has_table_privilege('zhudatuanpurchaseapi','member.profile','SELECT,INSERT,UPDATE,DELETE') then
    raise exception 'BUSINESS_RUNTIME_SCHEMA_VISIBILITY_INVALID';
  end if;
end
$assert$;

commit;
