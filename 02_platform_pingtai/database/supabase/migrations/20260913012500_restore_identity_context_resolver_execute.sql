begin;

select pg_advisory_xact_lock(hashtext('identity:context-resolver-execute:v1'));

do $precondition$
begin
  if not exists(select 1 from runtime.schemaversion
      where version='20260912250000'
        and checksum='24f71fb162010ad5da92d48532535e387f7b49cef24130835a86ea0e50997f5a')
    or exists(select 1 from runtime.schemaversion where version>'20260912250000') then
    raise exception 'IDENTITY_CONTEXT_RESOLVER_EXECUTE_PREDECESSOR_INVALID';
  end if;
  if to_regprocedure('identity.resolve_active_membership_context(text,text,text)') is null
    or to_regrole('zhudatuanidentityapi') is null then
    raise exception 'IDENTITY_CONTEXT_RESOLVER_EXECUTE_TARGET_MISSING';
  end if;
end
$precondition$;

grant execute on function identity.resolve_active_membership_context(text,text,text)
  to zhudatuanidentityapi;

insert into runtime.schemaversion(version,checksum)
values('20260913012500','d95056b7fa8aaa36afde8ae24b55566587e12251ca3d2b199e9c22d2e9a79ed1');

do $assert$
begin
  if not has_function_privilege(
      'zhudatuanidentityapi',
      'identity.resolve_active_membership_context(text,text,text)',
      'EXECUTE'
    )
    or not exists(select 1 from runtime.schemaversion
      where version='20260913012500'
        and checksum='d95056b7fa8aaa36afde8ae24b55566587e12251ca3d2b199e9c22d2e9a79ed1') then
    raise exception 'IDENTITY_CONTEXT_RESOLVER_EXECUTE_MIGRATION_INCOMPLETE';
  end if;
end
$assert$;

commit;
