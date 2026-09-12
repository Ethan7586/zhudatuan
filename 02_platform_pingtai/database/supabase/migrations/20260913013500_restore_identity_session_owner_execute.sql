begin;

select pg_advisory_xact_lock(hashtext('identity:session-owner-execute:v1'));

do $precondition$
begin
  if not exists(select 1 from runtime.schemaversion
      where version='20260913012500'
        and checksum='d95056b7fa8aaa36afde8ae24b55566587e12251ca3d2b199e9c22d2e9a79ed1')
    or exists(select 1 from runtime.schemaversion where version>'20260913012500') then
    raise exception 'IDENTITY_SESSION_OWNER_EXECUTE_PREDECESSOR_INVALID';
  end if;
  if to_regprocedure('identity.resolve_active_membership_context(text,text,text)') is null
    or to_regrole('shopmigration') is null then
    raise exception 'IDENTITY_SESSION_OWNER_EXECUTE_TARGET_MISSING';
  end if;
end
$precondition$;

grant execute on function identity.resolve_active_membership_context(text,text,text)
  to shopmigration;

insert into runtime.schemaversion(version,checksum)
values('20260913013500','a6a099b5f5c3e9827f1333ba00f7043803b9436f7ad22e28434ac7a8866fe26e');

do $assert$
begin
  if not has_function_privilege(
      'shopmigration',
      'identity.resolve_active_membership_context(text,text,text)',
      'EXECUTE'
    )
    or not exists(select 1 from runtime.schemaversion
      where version='20260913013500'
        and checksum='a6a099b5f5c3e9827f1333ba00f7043803b9436f7ad22e28434ac7a8866fe26e') then
    raise exception 'IDENTITY_SESSION_OWNER_EXECUTE_MIGRATION_INCOMPLETE';
  end if;
end
$assert$;

commit;
