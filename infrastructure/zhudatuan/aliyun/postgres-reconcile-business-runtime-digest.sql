begin;

select pg_advisory_xact_lock(hashtext('zhudatuan:business-runtime-digest-reconcile:v1'));

do $precondition$
declare authority oid := (select oid from pg_roles where rolname=current_user);
begin
  if current_database()<>'zhudatuan_registration'
    or not coalesce((select rolsuper from pg_roles where oid=authority),false) then
    raise exception 'BUSINESS_RUNTIME_DIGEST_RECONCILE_AUTHORITY_INVALID';
  end if;
  if not exists(select 1 from runtime.schemaversion
    where version='20260830105000'
      and checksum='b6ee9a1f1a8591f9efdf4c8c2362b9aa32a16b3ce018321df97669a56e6fcaaf')
    or exists(select 1 from runtime.schemaversion where version>'20260830105000') then
    raise exception 'BUSINESS_RUNTIME_DIGEST_RECONCILE_MIGRATION_HEAD_INVALID';
  end if;
  if not exists(select 1 from pg_proc where oid=to_regprocedure('public.digest(text,text)'))
    or to_regprocedure('deployment.business_runtime_roles_valid()') is null
    or to_regprocedure('deployment.runtime_database_boundary()') is null then
    raise exception 'BUSINESS_RUNTIME_DIGEST_RECONCILE_FUNCTION_MISSING';
  end if;
end
$precondition$;

grant execute on function public.digest(text,text) to zhudatuanwebapi,zhudatuanpurchaseapi;

do $assert$
declare boundary record;
begin
  if not deployment.business_runtime_roles_valid()
    or has_table_privilege('zhudatuanwebapi','member.profile','SELECT,INSERT,UPDATE,DELETE')
    or has_table_privilege('zhudatuanpurchaseapi','member.profile','SELECT,INSERT,UPDATE,DELETE')
    or has_table_privilege('zhudatuanwebapi','access.membership','SELECT,INSERT,UPDATE,DELETE')
    or has_table_privilege('zhudatuanpurchaseapi','access.membership','SELECT,INSERT,UPDATE,DELETE') then
    raise exception 'BUSINESS_RUNTIME_DIGEST_RECONCILE_ACL_INVALID';
  end if;
  select * into boundary from deployment.runtime_database_boundary();
  if boundary.active_platform_owner_count<>1 or not boundary.migration_head_valid
    or not boundary.retired_roles_valid or not boundary.business_roles_valid
    or not boundary.runtime_roles_valid or not boundary.boundary_roles_valid
    or boundary.retired_membership_count<>0 then
    raise exception 'BUSINESS_RUNTIME_DIGEST_RECONCILE_BOUNDARY_INVALID';
  end if;
end
$assert$;

commit;
