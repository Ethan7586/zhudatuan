begin;

select pg_advisory_xact_lock(hashtext('identity:storefront-member-context-owner:v1'));

do $precondition$
begin
  if not exists(select 1 from runtime.schemaversion
      where version='20260913013500'
        and checksum='a6a099b5f5c3e9827f1333ba00f7043803b9436f7ad22e28434ac7a8866fe26e')
    or exists(select 1 from runtime.schemaversion where version>'20260913013500') then
    raise exception 'STOREFRONT_MEMBER_CONTEXT_OWNER_PREDECESSOR_INVALID';
  end if;
  if to_regprocedure('identity.resolve_storefront_member_context(text,text)') is null
    or to_regrole('zhudatuanroot') is null
    or to_regrole('zhudatuanidentityapi') is null then
    raise exception 'STOREFRONT_MEMBER_CONTEXT_OWNER_TARGET_MISSING';
  end if;
end
$precondition$;

alter function identity.resolve_storefront_member_context(text,text) owner to zhudatuanroot;
revoke all on function identity.resolve_storefront_member_context(text,text) from public;
grant execute on function identity.resolve_storefront_member_context(text,text)
  to zhudatuanidentityapi;

insert into runtime.schemaversion(version,checksum)
values('20260913014500','75e0c2a57031b82c0746f18500153394d67efbac05324cb35dc86a05bff015be');

do $assert$
begin
  if not exists(select 1 from pg_proc function join pg_roles owner on owner.oid=function.proowner
      where function.oid='identity.resolve_storefront_member_context(text,text)'::regprocedure
        and function.prosecdef and owner.rolname='zhudatuanroot')
    or has_function_privilege('public','identity.resolve_storefront_member_context(text,text)','execute')
    or not has_function_privilege('zhudatuanidentityapi',
      'identity.resolve_storefront_member_context(text,text)','execute')
    or has_table_privilege('zhudatuanidentityapi','organization.membernoderegistration','select,insert,update,delete')
    or has_table_privilege('zhudatuanidentityapi','organization.node','select,insert,update,delete')
    or has_table_privilege('zhudatuanidentityapi','organization.noderelation','select,insert,update,delete')
    or not exists(select 1 from runtime.schemaversion where version='20260913014500'
      and checksum='75e0c2a57031b82c0746f18500153394d67efbac05324cb35dc86a05bff015be') then
    raise exception 'STOREFRONT_MEMBER_CONTEXT_OWNER_MIGRATION_INCOMPLETE';
  end if;
end
$assert$;

commit;
