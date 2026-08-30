begin;

select pg_advisory_xact_lock(hashtext('zhudatuan:sealed-owner-schema-visibility:v1'));

do $precondition$
declare authority oid := (select oid from pg_roles where rolname=current_user);
begin
  if current_database()<>'zhudatuan_registration'
    or not coalesce((select rolsuper from pg_roles where oid=authority),false) then
    raise exception 'SEALED_OWNER_SCHEMA_VISIBILITY_AUTHORITY_INVALID';
  end if;
  if not exists(select 1 from runtime.schemaversion
    where version='20260830105000'
      and checksum='b6ee9a1f1a8591f9efdf4c8c2362b9aa32a16b3ce018321df97669a56e6fcaaf')
    or exists(select 1 from runtime.schemaversion where version>'20260830105000') then
    raise exception 'SEALED_OWNER_SCHEMA_VISIBILITY_MIGRATION_HEAD_INVALID';
  end if;
  if not exists(select 1 from pg_roles where rolname='shopmigration'
      and not rolcanlogin and not rolsuper and not rolcreatedb and not rolcreaterole
      and not rolinherit and not rolreplication and not rolbypassrls)
    or exists(select 1 from pg_auth_members membership
      where membership.roleid=to_regrole('shopmigration') or membership.member=to_regrole('shopmigration')) then
    raise exception 'SEALED_OWNER_SCHEMA_VISIBILITY_ROLE_INVALID';
  end if;
  if exists(select 1 from pg_class relation join pg_namespace namespace on namespace.oid=relation.relnamespace
    where namespace.nspname in('identity','access') and relation.relkind in('r','p','S')
      and relation.relowner<>to_regrole('shopmigration')) then
    raise exception 'SEALED_OWNER_SCHEMA_VISIBILITY_OBJECT_OWNER_INVALID';
  end if;
end
$precondition$;

grant usage on schema identity,access to shopmigration;
revoke usage on schema deployment from shopmigration;

do $assert$
declare boundary record;
begin
  if not has_schema_privilege('shopmigration','identity','USAGE')
    or not has_schema_privilege('shopmigration','access','USAGE')
    or has_schema_privilege('shopmigration','deployment','USAGE')
    or not has_schema_privilege('zhudatuanidentityapi','identity','USAGE')
    or not has_table_privilege('zhudatuanidentityapi','identity.session','INSERT') then
    raise exception 'SEALED_OWNER_SCHEMA_VISIBILITY_ACL_INVALID';
  end if;
  select * into boundary from deployment.runtime_database_boundary();
  if boundary.active_platform_owner_count<>1 or not boundary.migration_head_valid
    or not boundary.retired_roles_valid or not boundary.business_roles_valid
    or not boundary.runtime_roles_valid or not boundary.boundary_roles_valid
    or boundary.retired_membership_count<>0 then
    raise exception 'SEALED_OWNER_SCHEMA_VISIBILITY_BOUNDARY_INVALID';
  end if;
end
$assert$;

commit;
